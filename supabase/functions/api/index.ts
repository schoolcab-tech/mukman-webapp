import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import bcryptImport from "npm:bcryptjs@2.4.3";
import {
  AI_MODELS,
  AI_SYSTEM,
  ACTIVITY_HEADERS,
  ACTIVITY_WIDTHS,
  FEEDBACK_HEADERS,
  FEEDBACK_WIDTHS,
  REVIEW_HEADERS,
  REVIEW_WIDTHS,
  SUMMARY_HEADERS,
  SUMMARY_WIDTHS,
  TEAM_HEADERS,
  TEAM_WIDTHS,
  TIMESHEET_HEADERS,
  TIMESHEET_WIDTHS,
  accessCookie,
  activityRows,
  apiPath,
  buildXlsx,
  exportScope,
  feedbackRow,
  istDate,
  isUuid,
  addDays,
  monthBounds,
  overdueTimesheets,
  periodRange,
  readCookie,
  reviewRow,
  signJwt,
  summaryRow,
  teamRow,
  timesheetDetailRow,
  timingSafeEqual,
  validateTimesheet,
  verifyJwt,
  weeklyLabel,
} from "../_shared/pure.js";

type BcryptApi = {
  hashSync: (password: string, rounds: number) => string;
  compareSync: (password: string, hash: string) => boolean;
};
const importedBcrypt = bcryptImport as BcryptApi & { default?: BcryptApi };
const bcrypt: BcryptApi = typeof importedBcrypt.hashSync === "function" ? importedBcrypt : importedBcrypt.default!;
const USER_FIELDS =
  "id,name,email,phone,title,department,reports_to,role,esop_applicable,active,must_change_password,slack_id,also_reports_to,created_at";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function allowOrigin(origin: string | null) {
  const configured = (Deno.env.get("FRONTEND_URL") || "http://localhost:3000")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowed = new Set([...configured, "http://localhost:3000", "http://127.0.0.1:3000"]);
  return origin && allowed.has(origin) ? origin : "";
}

function withCors(res: Response, origin: string | null) {
  const headers = new Headers(res.headers);
  const allow = allowOrigin(origin);
  if (allow) {
    headers.set("access-control-allow-origin", allow);
    headers.set("access-control-allow-credentials", "true");
    headers.set("vary", "origin");
  }
  return new Response(res.body, { status: res.status, headers });
}

function client() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new HttpError(500, "Supabase is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jwtSecret() {
  const secret = Deno.env.get("JWT_SECRET");
  if (!secret) throw new HttpError(500, "JWT_SECRET is not configured");
  return secret;
}

async function readJson(req: Request) {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

function fail(error: { message: string } | null, fallback = "Database error"): asserts error is null {
  if (error) {
    console.error(error);
    throw new HttpError(500, fallback);
  }
}

function asUser(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? "",
    title: row.title ?? "",
    department: row.department ?? "",
    reports_to: row.reports_to ?? null,
    role: row.role,
    esop_applicable: Boolean(row.esop_applicable),
    active: row.active !== false,
    must_change_password: Boolean(row.must_change_password),
    slack_id: row.slack_id ?? "",
    also_reports_to: Array.isArray(row.also_reports_to) ? row.also_reports_to : [],
    created_at: row.created_at,
  };
}

async function currentUser(req: Request, supabase: ReturnType<typeof client>) {
  const token = readCookie(req.headers.get("cookie"), "access_token");
  const header = req.headers.get("authorization") || "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const presented = token || bearer;
  if (!presented) throw new HttpError(401, "Not authenticated");
  let payload: { sub?: string };
  try {
    payload = await verifyJwt(presented, jwtSecret());
  } catch (error) {
    throw new HttpError(401, error instanceof Error && error.message === "expired" ? "Token expired" : "Invalid token");
  }
  if (!payload.sub || !isUuid(payload.sub)) throw new HttpError(401, "Invalid token");
  const { data, error } = await supabase.from("users").select(USER_FIELDS).eq("id", payload.sub).maybeSingle();
  fail(error);
  const user = asUser(data);
  if (!user || !user.active) throw new HttpError(401, "User not found");
  return user;
}

async function notify(
  supabase: ReturnType<typeof client>,
  userId: string,
  ntype: string,
  title: string,
  message: string,
  channel = "in_app",
  popup = false,
) {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type: ntype,
    title,
    message,
    channel,
    popup,
    read: false,
  });
  fail(error);
}

async function selectAll(query: () => any, cap = 10000) {
  const page = 1000;
  const out: any[] = [];
  for (let from = 0; from < cap; from += page) {
    const { data, error } = await query().range(from, from + page - 1);
    fail(error);
    const rows = data || [];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    const headers = new Headers();
    const allow = allowOrigin(origin);
    if (allow) {
      headers.set("access-control-allow-origin", allow);
      headers.set("access-control-allow-credentials", "true");
      headers.set("access-control-allow-headers", "authorization, content-type, apikey, x-webhook-id");
      headers.set("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
      headers.set("vary", "origin");
    }
    return new Response(null, { status: 204, headers });
  }

  try {
    const supabase = client();
    const url = new URL(req.url);
    const path = apiPath(url.pathname);
    const res = await dispatch(req, supabase, path, url);
    return withCors(res, origin);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : "Something went wrong. Please try again.";
    if (!(error instanceof HttpError)) console.error(error);
    return withCors(json({ detail: message }, status), origin);
  }
});

async function dispatch(req: Request, supabase: ReturnType<typeof client>, path: string, url: URL) {
  const method = req.method;
  if (method === "GET" && path === "/") return json({ message: "Mukman Group Internal Portal API" });

  if (method === "POST" && path === "/auth/login") return login(req, supabase);
  if (method === "POST" && path === "/auth/logout") return logout();
  if (method === "GET" && path === "/auth/me") return json(await currentUser(req, supabase));
  if (method === "POST" && path === "/auth/change-password") return changePassword(req, supabase);

  if (method === "GET" && path === "/content") return getContent(req, supabase);
  if (method === "PUT" && path.startsWith("/admin/content/")) return updateContent(req, supabase, decodeURIComponent(path.slice("/admin/content/".length)));
  if (method === "POST" && path === "/admin/ai-enhance") return aiEnhance(req, supabase);
  if (method === "GET" && path === "/org-chart") return orgChart(req, supabase);

  if (method === "POST" && path === "/timesheets") return submitTimesheet(req, supabase);
  if (method === "GET" && path === "/timesheets/my") return myTimesheets(req, supabase, url);
  if (method === "GET" && path === "/timesheets/reportee") return reporteeTimesheets(req, supabase, url);
  if (method === "GET" && path === "/timesheets/approvals") return timesheetApprovals(req, supabase);
  if (method === "GET" && path === "/timesheets/gaps") return timesheetGaps(req, supabase);
  if (method === "GET" && path === "/timesheets/export") return exportTimesheets(req, supabase, url);
  const timesheetReview = path.match(/^\/timesheets\/([^/]+)\/(approve|reject)$/);
  if (method === "POST" && timesheetReview) return reviewTimesheet(req, supabase, timesheetReview[1], timesheetReview[2]);

  if (method === "POST" && path === "/reviews") return submitReview(req, supabase);
  if (method === "GET" && path === "/reviews/my") return myReviews(req, supabase);
  if (method === "GET" && path === "/reviews/pending") return pendingReviews(req, supabase);
  const reviewAction = path.match(/^\/reviews\/([^/]+)\/(approve|reject)$/);
  if (method === "POST" && reviewAction) return actOnReview(req, supabase, reviewAction[1], reviewAction[2]);

  if (method === "POST" && path === "/feedback") return submitFeedback(req, supabase);
  if (method === "GET" && path === "/feedback/my") return myFeedback(req, supabase);
  if (method === "GET" && path === "/feedback/inbox") return feedbackInbox(req, supabase);
  const feedbackAction = path.match(/^\/feedback\/([^/]+)\/(forward|resolve)$/);
  if (method === "POST" && feedbackAction) return actOnFeedback(req, supabase, feedbackAction[1], feedbackAction[2]);

  if (method === "GET" && path === "/notifications") return listNotifications(req, supabase);
  if (method === "POST" && path === "/notifications/read-all") return readAllNotifications(req, supabase);
  const readOne = path.match(/^\/notifications\/([^/]+)\/read$/);
  if (method === "POST" && readOne) return readNotification(req, supabase, readOne[1]);

  if (method === "GET" && path === "/penalty-rules") return listPenalties(req, supabase);
  if (method === "PUT" && path.startsWith("/admin/penalty-rules/")) {
    return updatePenalty(req, supabase, decodeURIComponent(path.slice("/admin/penalty-rules/".length)));
  }
  if (method === "GET" && path === "/admin/employees") return listEmployees(req, supabase);
  if (method === "POST" && path === "/admin/employees") return createEmployee(req, supabase);
  const employeeUpdate = path.match(/^\/admin\/employees\/([^/]+)$/);
  if (method === "PUT" && employeeUpdate) return updateEmployee(req, supabase, employeeUpdate[1]);
  if (method === "POST" && path === "/admin/broadcast") return broadcast(req, supabase);

  if (method === "POST" && path === "/cron/timesheet-reminders") return cronTimesheets(req, supabase);
  if (method === "POST" && path === "/cron/weekly-review-reminder") return cronWeekly(req, supabase);

  throw new HttpError(404, "Not Found");
}

async function login(req: Request, supabase: ReturnType<typeof client>) {
  const body = await readJson(req);
  const ident = String(body.identifier || "").trim();
  const password = String(body.password || "");
  if (!ident || !password) throw new HttpError(401, "Invalid credentials");
  const email = ident.toLowerCase();
  const byEmail = await supabase.from("users").select("*").eq("email", email).maybeSingle();
  fail(byEmail.error);
  let found = byEmail.data;
  if (!found) {
    const byPhone = await supabase.from("users").select("*").eq("phone", ident).maybeSingle();
    fail(byPhone.error);
    found = byPhone.data;
  }
  let passwordOk = false;
  try {
    passwordOk = Boolean(found && bcrypt.compareSync(password, found.password_hash));
  } catch {
    passwordOk = false;
  }
  if (!found || !passwordOk) throw new HttpError(401, "Invalid credentials");
  if (found.active === false) throw new HttpError(403, "Account deactivated. Contact admin.");
  const token = await signJwt(
    { sub: found.id, exp: Math.floor(Date.now() / 1000) + 7 * 86400, type: "access" },
    jwtSecret(),
  );
  const res = json(asUser(found));
  res.headers.set("set-cookie", accessCookie(token, 7 * 86400));
  return res;
}

function logout() {
  const res = json({ ok: true });
  res.headers.set("set-cookie", accessCookie("", 0));
  return res;
}

async function changePassword(req: Request, supabase: ReturnType<typeof client>) {
  const user = await currentUser(req, supabase);
  const body = await readJson(req);
  const next = String(body.new_password || "");
  if (next.length < 6) throw new HttpError(400, "New password must be at least 6 characters");
  const { data, error } = await supabase.from("users").select("id,password_hash").eq("id", user.id).maybeSingle();
  fail(error);
  if (!data || !bcrypt.compareSync(String(body.current_password || ""), data.password_hash)) {
    throw new HttpError(400, "Current password is incorrect");
  }
  const { error: updateError } = await supabase.from("users").update({
    password_hash: bcrypt.hashSync(next, 10),
    must_change_password: false,
  }).eq("id", user.id);
  fail(updateError);
  return json({ ok: true });
}

async function getContent(req: Request, supabase: ReturnType<typeof client>) {
  await currentUser(req, supabase);
  const { data, error } = await supabase.from("content").select("*").limit(100);
  fail(error);
  const out: Record<string, unknown> = {};
  for (const row of data || []) out[row.key] = row;
  return json(out);
}

async function updateContent(req: Request, supabase: ReturnType<typeof client>, key: string) {
  const admin = await currentUser(req, supabase);
  if (admin.role !== "admin") throw new HttpError(403, "Admin access only");
  const body = await readJson(req);
  if (typeof body.title !== "string" || typeof body.body !== "string") throw new HttpError(400, "Title and body are required");
  const update: Record<string, unknown> = {
    title: body.title,
    body: body.body,
    updated_at: new Date().toISOString(),
    updated_by: admin.id,
  };
  if (body.stats != null) update.stats = body.stats;
  const { data: existing, error: findError } = await supabase.from("content").select("id").eq("key", key).maybeSingle();
  fail(findError);
  if (existing) {
    const { error } = await supabase.from("content").update(update).eq("key", key);
    fail(error);
  } else {
    const { error } = await supabase.from("content").insert({ key, ...update });
    fail(error);
  }
  const { data, error } = await supabase.from("content").select("*").eq("key", key).maybeSingle();
  fail(error);
  return json(data);
}

async function aiEnhance(req: Request, supabase: ReturnType<typeof client>) {
  const admin = await currentUser(req, supabase);
  if (admin.role !== "admin") throw new HttpError(403, "Admin access only");
  const body = await readJson(req);
  const model = String(body.model || "gpt-5.4");
  const provider = (AI_MODELS as Record<string, string>)[model];
  if (!provider) throw new HttpError(400, `Unsupported AI model: ${model}`);
  if (typeof body.text !== "string") throw new HttpError(400, "text is required");
  const prompt = `Section: ${body.section || "general"}\nTone: ${body.tone || "corporate"}\n\nDraft text:\n${body.text}`;
  let enhanced = "";
  if (provider === "openai") {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new HttpError(500, "OPENAI_API_KEY is not configured");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: AI_SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new HttpError(502, data?.error?.message || "AI request failed");
    enhanced = data?.choices?.[0]?.message?.content || "";
  } else {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) throw new HttpError(500, "ANTHROPIC_API_KEY is not configured");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: AI_SYSTEM,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new HttpError(502, data?.error?.message || "AI request failed");
    enhanced = (data.content || []).map((part: { text?: string }) => part.text || "").join("");
  }
  if (!enhanced) throw new HttpError(502, "AI request returned no text");
  return json({ enhanced: String(enhanced), model });
}

async function orgChart(req: Request, supabase: ReturnType<typeof client>) {
  await currentUser(req, supabase);
  const { data, error } = await supabase.from("users").select(USER_FIELDS).eq("active", true).order("created_at").limit(500);
  fail(error);
  const users = (data || []).map((row) => asUser(row)!);
  const people = users.map((user) => ({
    id: user.id,
    name: user.name,
    title: user.title || "",
    department: user.department || "",
    role: user.role,
    reports_to: user.reports_to || null,
    also_reports_to: user.also_reports_to || [],
    esop_applicable: user.esop_applicable,
    slack_id: user.slack_id || "",
  }));
  const founder = users.find((user) => user.role === "admin" && !user.reports_to) || null;
  const { data: nodes, error: nodeError } = await supabase.from("org_nodes").select("*").limit(100);
  fail(nodeError);
  const virtual = [];
  for (const node of nodes || []) {
    let parentId: string | null = null;
    if (node.parent_email === "founder") parentId = founder ? founder.id : null;
    else if (node.parent_email) {
      const match = users.find((user) => user.email === node.parent_email);
      parentId = match ? match.id : null;
    }
    virtual.push({
      id: node.key,
      name: node.name,
      title: node.title || "",
      kind: node.kind || "open",
      reports_to: parentId,
      virtual: true,
    });
  }
  return json({ people, virtual, slack_team_id: Deno.env.get("SLACK_TEAM_ID") || "" });
}

async function submitTimesheet(req: Request, supabase: ReturnType<typeof client>) {
  const user = await currentUser(req, supabase);
  const body = await readJson(req);
  const checked = validateTimesheet({
    date: String(body.date || ""),
    status: String(body.status || ""),
    tasks: body.tasks,
    idle_hours: body.idle_hours,
    idle_reason: body.idle_reason,
    today: istDate(),
  });
  if (typeof checked === "string") throw new HttpError(400, checked);
  const { data: existing, error: findError } = await supabase
    .from("timesheets")
    .select("id,approval_status")
    .eq("user_id", user.id)
    .eq("date", body.date)
    .maybeSingle();
  fail(findError);
  if (existing?.approval_status === "approved") throw new HttpError(400, "This day is already approved and locked");
  const approver = user.reports_to || null;
  const doc = {
    user_id: user.id,
    user_name: user.name,
    date: body.date,
    status: body.status,
    tasks: checked.kept,
    idle_hours: checked.idle,
    idle_reason: String(body.idle_reason || ""),
    hours: checked.total,
    total_hours: checked.total,
    achievements: String(body.achievements || ""),
    approval_status: approver ? "pending" : "approved",
    approver_id: approver,
    comments: "",
    created_at: new Date().toISOString(),
    reviewed_at: null,
    reviewed_by: null,
  };
  let id = existing?.id;
  if (existing) {
    const { error } = await supabase.from("timesheets").update(doc).eq("id", existing.id);
    fail(error);
  } else {
    const { data, error } = await supabase.from("timesheets").insert(doc).select("id").single();
    fail(error);
    id = data.id;
  }
  if (approver) {
    await notify(
      supabase,
      approver,
      "approval_request",
      `Timesheet approval: ${user.name}`,
      `${user.name} submitted a timesheet for ${body.date} (${body.status}). Please review.`,
    );
  }
  return json({ id, ...doc });
}

async function myTimesheets(req: Request, supabase: ReturnType<typeof client>, url: URL) {
  const user = await currentUser(req, supabase);
  let query = supabase.from("timesheets").select("*").eq("user_id", user.id);
  const bounds = monthBounds(url.searchParams.get("month") || "");
  if (bounds) query = query.gte("date", bounds.start).lte("date", bounds.end);
  const { data, error } = await query.order("date", { ascending: false }).limit(400);
  fail(error);
  return json(data || []);
}

async function reporteeTimesheets(req: Request, supabase: ReturnType<typeof client>, url: URL) {
  const user = await currentUser(req, supabase);
  const userId = url.searchParams.get("user_id") || "";
  if (!isUuid(userId)) throw new HttpError(400, "Choose a reportee");
  const { data: people, error: peopleError } = await supabase
    .from("users")
    .select("id,name,reports_to,also_reports_to,role")
    .limit(500);
  fail(peopleError);
  const allowed = exportScope(people || [], user.id, user.role).some((person) => String(person.id) === userId);
  if (!allowed) throw new HttpError(403, "You can only view timesheets of people who report to you");
  let query = supabase.from("timesheets").select("*").eq("user_id", userId);
  const bounds = monthBounds(url.searchParams.get("month") || "");
  if (bounds) query = query.gte("date", bounds.start).lte("date", bounds.end);
  const { data, error } = await query.order("date", { ascending: false }).limit(400);
  fail(error);
  return json(data || []);
}

async function timesheetGaps(req: Request, supabase: ReturnType<typeof client>) {
  const user = await currentUser(req, supabase);
  const { data, error } = await supabase
    .from("users")
    .select("id,name,reports_to,also_reports_to,role,created_at")
    .eq("active", true)
    .limit(500);
  fail(error);
  const people = data || [];
  const scope = exportScope(people, user.id, user.role);
  const seen = new Set<string>();
  const watched = [];
  for (const person of people) {
    if (String(person.id) !== String(user.id)) continue;
    watched.push(person);
    seen.add(String(person.id));
  }
  for (const person of scope) {
    const id = String(person.id);
    if (seen.has(id)) continue;
    watched.push(person);
    seen.add(id);
  }
  const today = istDate();
  const ids = watched.map((person) => person.id);
  const entries = ids.length
    ? await selectAll(
      () => supabase.from("timesheets").select("user_id,date").in("user_id", ids).gte("date", addDays(today, -800)).lte("date", today).order("date", { ascending: false }),
      20000,
    )
    : [];
  return json(overdueTimesheets(watched, entries, today));
}

async function timesheetApprovals(req: Request, supabase: ReturnType<typeof client>) {
  const user = await currentUser(req, supabase);
  let query = supabase.from("timesheets").select("*").eq("approval_status", "pending");
  if (user.role !== "admin") query = query.eq("approver_id", user.id);
  const { data, error } = await query.order("date", { ascending: false }).limit(400);
  fail(error);
  return json(data || []);
}

async function reviewTimesheet(req: Request, supabase: ReturnType<typeof client>, id: string, action: string) {
  const user = await currentUser(req, supabase);
  if (!isUuid(id)) throw new HttpError(404, "Timesheet not found");
  const body = await readJson(req);
  const { data: sheet, error } = await supabase.from("timesheets").select("*").eq("id", id).maybeSingle();
  fail(error);
  if (!sheet) throw new HttpError(404, "Timesheet not found");
  if (String(sheet.approver_id || "") !== user.id && user.role !== "admin") throw new HttpError(403, "Not the approver for this entry");
  if (sheet.approval_status !== "pending") throw new HttpError(400, "Already reviewed");
  const comment = String(body.comment || "");
  const approvalStatus = action === "approve" ? "approved" : "rejected";
  const { error: updateError } = await supabase.from("timesheets").update({
    approval_status: approvalStatus,
    comments: comment,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  }).eq("id", id);
  fail(updateError);
  const verb = approvalStatus;
  await notify(
    supabase,
    sheet.user_id,
    "status_update",
    `Timesheet ${verb}: ${sheet.date}`,
    `Your timesheet for ${sheet.date} was ${verb} by ${user.name}.` + (comment ? ` Comment: ${comment}` : ""),
  );
  return json({ ok: true });
}

async function exportTimesheets(req: Request, supabase: ReturnType<typeof client>, url: URL) {
  const user = await currentUser(req, supabase);
  const today = istDate();
  const range = periodRange(
    url.searchParams.get("period") || "month",
    today,
    url.searchParams.get("start"),
    url.searchParams.get("end"),
  );
  if (!range) throw new HttpError(400, "Invalid period or date range");
  const { data, error } = await supabase
    .from("users")
    .select("id,name,email,phone,title,department,reports_to,also_reports_to,role,active")
    .limit(500);
  fail(error);
  const people = data || [];
  let scope = exportScope(people, user.id, user.role);
  const requested = url.searchParams.get("user_id") || "";
  if (requested) {
    if (!isUuid(requested)) throw new HttpError(400, "Choose a person");
    const person = scope.find((candidate) => String(candidate.id) === requested);
    if (!person) throw new HttpError(403, "You can only export timesheets of people who report to you");
    scope = [person];
  }
  if (!scope.length) throw new HttpError(403, "You have no reportees to export");
  const names = new Map(people.map((person) => [String(person.id), person.name]));
  const ids = scope.map((person) => person.id);
  const entries = await selectAll(
    () => supabase.from("timesheets").select("*").in("user_id", ids).gte("date", range.s).lte("date", range.e).order("date", { ascending: true }),
  );
  const submittedFrom = `${range.s}T00:00:00+05:30`;
  const submittedTo = `${range.e}T23:59:59.999+05:30`;
  const reviews = await selectAll(
    () => supabase.from("reviews").select("*").in("user_id", ids).gte("created_at", submittedFrom).lte("created_at", submittedTo).order("created_at", { ascending: true }),
  );
  const feedback = await selectAll(
    () => supabase.from("feedback").select("*").in("user_id", ids).gte("created_at", submittedFrom).lte("created_at", submittedTo).order("created_at", { ascending: true }),
  );
  const bytes = buildXlsx([
    {
      name: "Team",
      headers: TEAM_HEADERS,
      rows: scope.map((person) => teamRow(person, names.get(String(person.reports_to)) || "")),
      widths: TEAM_WIDTHS,
    },
    {
      name: "Timesheets",
      headers: TIMESHEET_HEADERS,
      rows: entries.map(timesheetDetailRow),
      widths: TIMESHEET_WIDTHS,
    },
    {
      name: "Activities",
      headers: ACTIVITY_HEADERS,
      rows: activityRows(entries),
      widths: ACTIVITY_WIDTHS,
    },
    {
      name: "Summary",
      headers: SUMMARY_HEADERS,
      rows: scope.map((person) => summaryRow(person, entries)),
      widths: SUMMARY_WIDTHS,
    },
    {
      name: "Reviews",
      headers: REVIEW_HEADERS,
      rows: reviews.map(reviewRow),
      widths: REVIEW_WIDTHS,
    },
    {
      name: "Feedback",
      headers: FEEDBACK_HEADERS,
      rows: feedback.map(feedbackRow),
      widths: FEEDBACK_WIDTHS,
    },
  ]);
  const personName = requested ? String(scope[0].name || "person").replace(/[^\w.-]+/g, "-").replace(/^-|-$/g, "") || "person" : "";
  const filename = requested
    ? `mukman-${personName}-${range.s}-to-${range.e}.xlsx`
    : `mukman-team-${url.searchParams.get("period") || "month"}-${range.s}-to-${range.e}.xlsx`;
  return new Response(bytes, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

async function submitReview(req: Request, supabase: ReturnType<typeof client>) {
  const user = await currentUser(req, supabase);
  const body = await readJson(req);
  const periodType = String(body.period_type || "");
  if (!["weekly", "monthly", "quarterly", "annual"].includes(periodType)) throw new HttpError(400, "Invalid period type");
  const approver = user.reports_to || null;
  const doc = {
    user_id: user.id,
    user_name: user.name,
    period_type: periodType,
    period_label: String(body.period_label || ""),
    content: String(body.content || ""),
    status: approver ? "pending" : "approved",
    current_approver_id: approver,
    chain: [],
  };
  const { data, error } = await supabase.from("reviews").insert(doc).select("id").single();
  fail(error);
  if (approver) {
    await notify(
      supabase,
      approver,
      "approval_request",
      `${periodType[0].toUpperCase()}${periodType.slice(1)} review: ${user.name}`,
      `${user.name} submitted their ${periodType} review (${doc.period_label}). Please review.`,
    );
  }
  return json({ id: data.id });
}

async function myReviews(req: Request, supabase: ReturnType<typeof client>) {
  const user = await currentUser(req, supabase);
  const { data, error } = await supabase.from("reviews").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
  fail(error);
  return json(data || []);
}

async function pendingReviews(req: Request, supabase: ReturnType<typeof client>) {
  const user = await currentUser(req, supabase);
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("current_approver_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(200);
  fail(error);
  return json(data || []);
}

async function actOnReview(req: Request, supabase: ReturnType<typeof client>, id: string, action: string) {
  const user = await currentUser(req, supabase);
  if (!isUuid(id)) throw new HttpError(404, "Review not found");
  const body = await readJson(req);
  const { data: review, error } = await supabase.from("reviews").select("*").eq("id", id).maybeSingle();
  fail(error);
  if (!review) throw new HttpError(404, "Review not found");
  if (String(review.current_approver_id || "") !== user.id && user.role !== "admin") throw new HttpError(403, "Not the current approver");
  const comment = String(body.comment || "");
  const entry = { approver_id: user.id, name: user.name, action, comment, at: new Date().toISOString() };
  const chain = Array.isArray(review.chain) ? review.chain : [];
  if (action === "reject") {
    const { error: updateError } = await supabase.from("reviews").update({
      chain: [...chain, entry],
      status: "rejected",
      current_approver_id: null,
    }).eq("id", id);
    fail(updateError);
    await notify(
      supabase,
      review.user_id,
      "status_update",
      "Review rejected",
      `Your ${review.period_type} review (${review.period_label}) was rejected by ${user.name}.` + (comment ? ` Comment: ${comment}` : ""),
    );
    return json({ ok: true });
  }
  if (review.status !== "pending") throw new HttpError(400, "Already finalized");
  const { data: me, error: meError } = await supabase.from("users").select("reports_to").eq("id", user.id).maybeSingle();
  fail(meError);
  const next = me?.reports_to || null;
  if (next) {
    const { error: updateError } = await supabase.from("reviews").update({
      chain: [...chain, entry],
      current_approver_id: next,
    }).eq("id", id);
    fail(updateError);
    const label = `${review.period_type[0].toUpperCase()}${review.period_type.slice(1)}`;
    await notify(
      supabase,
      next,
      "approval_request",
      `${label} review escalation: ${review.user_name}`,
      `${user.name} approved ${review.user_name}'s ${review.period_type} review (${review.period_label}). Final approval pending with you.`,
    );
    await notify(
      supabase,
      review.user_id,
      "status_update",
      "Review moved up",
      `Your ${review.period_type} review (${review.period_label}) was approved by ${user.name} and escalated for final approval.`,
    );
  } else {
    const { error: updateError } = await supabase.from("reviews").update({
      chain: [...chain, entry],
      status: "approved",
      current_approver_id: null,
    }).eq("id", id);
    fail(updateError);
    await notify(
      supabase,
      review.user_id,
      "status_update",
      "Review fully approved",
      `Your ${review.period_type} review (${review.period_label}) received final approval from ${user.name}.`,
    );
  }
  return json({ ok: true });
}

async function submitFeedback(req: Request, supabase: ReturnType<typeof client>) {
  const user = await currentUser(req, supabase);
  const body = await readJson(req);
  const owner = user.reports_to || null;
  const doc = {
    user_id: user.id,
    user_name: user.name,
    subject: String(body.subject || ""),
    message: String(body.message || ""),
    status: "open",
    current_owner_id: owner,
    history: [],
  };
  const { data, error } = await supabase.from("feedback").insert(doc).select("id").single();
  fail(error);
  if (owner) {
    await notify(
      supabase,
      owner,
      "approval_request",
      `Feedback from ${user.name}`,
      `New feedback: ${doc.subject}. Please review in the Feedback section.`,
    );
  }
  return json({ id: data.id });
}

async function myFeedback(req: Request, supabase: ReturnType<typeof client>) {
  const user = await currentUser(req, supabase);
  const { data, error } = await supabase.from("feedback").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
  fail(error);
  return json(data || []);
}

async function feedbackInbox(req: Request, supabase: ReturnType<typeof client>) {
  const user = await currentUser(req, supabase);
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("current_owner_id", user.id)
    .neq("status", "resolved")
    .order("created_at", { ascending: false })
    .limit(200);
  fail(error);
  return json(data || []);
}

async function actOnFeedback(req: Request, supabase: ReturnType<typeof client>, id: string, action: string) {
  const user = await currentUser(req, supabase);
  if (!isUuid(id)) throw new HttpError(404, "Feedback not found");
  const { data: item, error } = await supabase.from("feedback").select("*").eq("id", id).maybeSingle();
  fail(error);
  if (!item) throw new HttpError(404, "Feedback not found");
  if (String(item.current_owner_id || "") !== user.id && user.role !== "admin") throw new HttpError(403, "Not assigned to you");
  const history = Array.isArray(item.history) ? item.history : [];
  const at = new Date().toISOString();
  if (action === "forward") {
    const { data: me, error: meError } = await supabase.from("users").select("reports_to").eq("id", user.id).maybeSingle();
    fail(meError);
    if (!me?.reports_to) throw new HttpError(400, "No senior above you to forward to");
    const { error: updateError } = await supabase.from("feedback").update({
      current_owner_id: me.reports_to,
      status: "forwarded",
      history: [...history, { by: user.name, action: "forwarded", at }],
    }).eq("id", id);
    fail(updateError);
    await notify(
      supabase,
      me.reports_to,
      "approval_request",
      `Escalated feedback: ${item.subject}`,
      `${user.name} forwarded feedback from ${item.user_name} to you.`,
    );
    return json({ ok: true });
  }
  const { error: updateError } = await supabase.from("feedback").update({
    status: "resolved",
    current_owner_id: null,
    history: [...history, { by: user.name, action: "resolved", at }],
  }).eq("id", id);
  fail(updateError);
  await notify(
    supabase,
    item.user_id,
    "status_update",
    "Feedback resolved",
    `Your feedback "${item.subject}" was marked resolved by ${user.name}.`,
  );
  return json({ ok: true });
}

async function listNotifications(req: Request, supabase: ReturnType<typeof client>) {
  const user = await currentUser(req, supabase);
  const { data, error } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
  fail(error);
  return json(data || []);
}

async function readNotification(req: Request, supabase: ReturnType<typeof client>, id: string) {
  const user = await currentUser(req, supabase);
  if (isUuid(id)) {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", user.id);
    fail(error);
  }
  return json({ ok: true });
}

async function readAllNotifications(req: Request, supabase: ReturnType<typeof client>) {
  const user = await currentUser(req, supabase);
  const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", user.id);
  fail(error);
  return json({ ok: true });
}

async function listPenalties(req: Request, supabase: ReturnType<typeof client>) {
  await currentUser(req, supabase);
  const { data, error } = await supabase.from("penalty_rules").select("*").limit(50);
  fail(error);
  return json(data || []);
}

async function updatePenalty(req: Request, supabase: ReturnType<typeof client>, key: string) {
  const admin = await currentUser(req, supabase);
  if (admin.role !== "admin") throw new HttpError(403, "Admin access only");
  const body = await readJson(req);
  const percent = Number(body.percent);
  if (!Number.isFinite(percent) || typeof body.description !== "string" || typeof body.enabled !== "boolean") {
    throw new HttpError(400, "Invalid penalty rule");
  }
  const { data, error } = await supabase
    .from("penalty_rules")
    .update({ percent, description: body.description, enabled: body.enabled })
    .eq("key", key)
    .select("*")
    .maybeSingle();
  fail(error);
  if (!data) throw new HttpError(404, "Not Found");
  return json(data);
}

function employeeFrom(body: Record<string, unknown>) {
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  if (!name || !email) throw new HttpError(400, "Name and email are required");
  const reports = body.reports_to ? String(body.reports_to) : null;
  if (reports && !isUuid(reports)) throw new HttpError(400, "Invalid manager");
  return {
    name,
    email,
    phone: String(body.phone || ""),
    title: String(body.title || ""),
    department: String(body.department || ""),
    reports_to: reports,
    role: body.role === "admin" ? "admin" : "employee",
    esop_applicable: Boolean(body.esop_applicable),
    active: body.active !== false,
    slack_id: String(body.slack_id || ""),
    password: body.password ? String(body.password) : "",
  };
}

async function listEmployees(req: Request, supabase: ReturnType<typeof client>) {
  const admin = await currentUser(req, supabase);
  if (admin.role !== "admin") throw new HttpError(403, "Admin access only");
  const { data, error } = await supabase.from("users").select(USER_FIELDS).order("created_at").limit(500);
  fail(error);
  return json((data || []).map((row) => asUser(row)));
}

async function createEmployee(req: Request, supabase: ReturnType<typeof client>) {
  const admin = await currentUser(req, supabase);
  if (admin.role !== "admin") throw new HttpError(403, "Admin access only");
  const input = employeeFrom(await readJson(req));
  const { data: existing, error: findError } = await supabase.from("users").select("id").eq("email", input.email).maybeSingle();
  fail(findError);
  if (existing) throw new HttpError(400, "Email already exists");
  const { password, ...fields } = input;
  const { data, error } = await supabase.from("users").insert({
    ...fields,
    password_hash: bcrypt.hashSync(password || "Schoolcab@1", 10),
    must_change_password: true,
  }).select(USER_FIELDS).single();
  if (error) {
    console.error(error);
    throw new HttpError(error.code === "23503" ? 400 : 500, error.code === "23503" ? "Manager not found" : "Database error");
  }
  return json(asUser(data));
}

async function updateEmployee(req: Request, supabase: ReturnType<typeof client>, id: string) {
  const admin = await currentUser(req, supabase);
  if (admin.role !== "admin") throw new HttpError(403, "Admin access only");
  if (!isUuid(id)) throw new HttpError(404, "Employee not found");
  const input = employeeFrom(await readJson(req));
  const { data: existing, error: findError } = await supabase.from("users").select("id").eq("id", id).maybeSingle();
  fail(findError);
  if (!existing) throw new HttpError(404, "Employee not found");
  const { password, ...fields } = input;
  const update: Record<string, unknown> = { ...fields };
  if (password) {
    update.password_hash = bcrypt.hashSync(password, 10);
    update.must_change_password = true;
  }
  const { data, error } = await supabase.from("users").update(update).eq("id", id).select(USER_FIELDS).single();
  if (error) {
    console.error(error);
    if (error.code === "23505") throw new HttpError(400, "Email already exists");
    if (error.code === "23503") throw new HttpError(400, "Manager not found");
    throw new HttpError(500, "Database error");
  }
  return json(asUser(data));
}

async function broadcast(req: Request, supabase: ReturnType<typeof client>) {
  const admin = await currentUser(req, supabase);
  if (admin.role !== "admin") throw new HttpError(403, "Admin access only");
  const body = await readJson(req);
  const title = String(body.title || "");
  const message = String(body.message || "");
  const { data, error } = await supabase.from("users").select("id").eq("active", true).limit(500);
  fail(error);
  const users = data || [];
  if (users.length) {
    const { error: insertError } = await supabase.from("notifications").insert(users.map((person) => ({
      user_id: person.id,
      type: "broadcast",
      title,
      message,
      channel: "in_app",
      popup: true,
      read: false,
    })));
    fail(insertError);
  }
  return json({ sent: users.length });
}

function assertCron(req: Request) {
  const header = req.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const secret = Deno.env.get("WEBHOOK_CRON_SECRET") || "";
  if (!token || !secret || !timingSafeEqual(token, secret)) throw new HttpError(401, "Unauthorized");
}

async function claimRun(supabase: ReturnType<typeof client>, runId: string, job: string) {
  const { error } = await supabase.from("cron_runs").insert({ run_id: runId, job });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error(error);
  throw new HttpError(500, "Database error");
}

async function cronTimesheets(req: Request, supabase: ReturnType<typeof client>) {
  assertCron(req);
  let body: { run_id?: string } = {};
  try {
    body = await readJson(req);
  } catch {
    body = {};
  }
  const runId = body.run_id || req.headers.get("x-webhook-id") || `manual-${Math.floor(Date.now() / 1000)}`;
  if (!(await claimRun(supabase, runId, "timesheet"))) return json({ ok: true, run_id: runId });
  const today = istDate();
  const { data: rules, error: ruleError } = await supabase.from("penalty_rules").select("key,percent");
  fail(ruleError);
  const byKey = Object.fromEntries((rules || []).map((rule) => [rule.key, rule]));
  const salary = byKey.ts_delay_5d?.percent ?? 10;
  const esop = byKey.ts_delay_10d?.percent ?? 10;
  const { data: users, error } = await supabase.from("users").select("id,name,esop_applicable").eq("active", true).limit(500);
  fail(error);
  const ids = (users || []).map((person) => person.id);
  const filled = ids.length
    ? await selectAll(() => supabase.from("timesheets").select("user_id").in("user_id", ids).eq("date", today))
    : [];
  const have = new Set(filled.map((row) => row.user_id));
  const missing = (users || []).filter((person) => !have.has(person.id));
  if (missing.length) {
    const { error: insertError } = await supabase.from("notifications").insert(missing.map((person) => {
      let message = `Hi ${person.name}, your timesheet for ${today} is not filled yet. A continuous delay of 5 days will result in a ${salary}% salary payout decline`;
      message += person.esop_applicable ? `, and a 10-day delay in a ${esop}% ownership/ESOP decline.` : ".";
      return {
        user_id: person.id,
        type: "penalty_warning",
        title: `Timesheet missing for ${today}`,
        message,
        channel: "whatsapp_mock",
        popup: false,
        read: false,
      };
    }));
    fail(insertError);
  }
  return json({ ok: true, run_id: runId });
}

async function cronWeekly(req: Request, supabase: ReturnType<typeof client>) {
  assertCron(req);
  let body: { run_id?: string } = {};
  try {
    body = await readJson(req);
  } catch {
    body = {};
  }
  const runId = body.run_id || req.headers.get("x-webhook-id") || `manual-${Math.floor(Date.now() / 1000)}`;
  if (!(await claimRun(supabase, runId, "weekly_review"))) return json({ ok: true, run_id: runId });
  const label = weeklyLabel(istDate());
  const { data: rules, error: ruleError } = await supabase.from("penalty_rules").select("key,percent");
  fail(ruleError);
  const byKey = Object.fromEntries((rules || []).map((rule) => [rule.key, rule]));
  const percent = byKey.weekly_review_3_missed?.percent ?? 10;
  const { data: users, error } = await supabase.from("users").select("id,name").eq("active", true).limit(500);
  fail(error);
  const ids = (users || []).map((person) => person.id);
  const filed = ids.length
    ? await selectAll(() =>
      supabase.from("reviews").select("user_id").in("user_id", ids).eq("period_type", "weekly").eq("period_label", label)
    )
    : [];
  const have = new Set(filed.map((row) => row.user_id));
  const missing = (users || []).filter((person) => !have.has(person.id));
  if (missing.length) {
    const { error: insertError } = await supabase.from("notifications").insert(missing.map((person) => ({
      user_id: person.id,
      type: "penalty_warning",
      title: `Weekly review due: ${label}`,
      message: `Hi ${person.name}, your weekly summary for ${label} is due today. Missing 3 consecutive weekly summaries will result in a ${percent}% penalty on salary or ownership as per policy.`,
      channel: "whatsapp_mock",
      popup: false,
      read: false,
    })));
    fail(insertError);
  }
  return json({ ok: true, run_id: runId });
}
