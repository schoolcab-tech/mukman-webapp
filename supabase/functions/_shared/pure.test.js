import assert from "node:assert/strict";
import test from "node:test";
import {
  activityRows,
  apiPath,
  accessCookie,
  buildXlsx,
  exportScope,
  feedbackRow,
  istDate,
  monthBounds,
  periodRange,
  readCookie,
  reviewRow,
  signJwt,
  overdueTimesheets,
  summaryRow,
  timesheetDetailRow,
  validateTimesheet,
  verifyJwt,
  weeklyLabel,
} from "./pure.js";

test("api path strips the Supabase function prefix", () => {
  assert.equal(apiPath("/functions/v1/api/auth/login"), "/auth/login");
  assert.equal(apiPath("/api/timesheets/my"), "/timesheets/my");
  assert.equal(apiPath("/functions/v1/api"), "/");
  assert.equal(apiPath("/functions/v1/api/"), "/");
});

test("cookie round trip header", () => {
  const header = accessCookie("abc.def", 60);
  assert.equal(readCookie(header, "access_token"), "abc.def");
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=None/);
});

test("IST date and ISO week match the previous Python rules", () => {
  const utc = new Date("2026-10-31T18:30:00.000Z");
  assert.equal(istDate(utc), "2026-11-01");
  assert.equal(weeklyLabel("2026-10-31"), "2026-W44");
  assert.deepEqual(periodRange("week", "2026-10-31"), { s: "2026-10-26", e: "2026-10-31" });
  assert.deepEqual(periodRange("month", "2026-10-31"), { s: "2026-10-01", e: "2026-10-31" });
  assert.deepEqual(monthBounds("2026-02"), { start: "2026-02-01", end: "2026-02-28" });
  assert.equal(periodRange("custom", "2026-10-31", "2026-10-10", "2026-10-01"), null);
});

test("timesheet validation keeps the FastAPI messages", () => {
  assert.equal(
    validateTimesheet({ date: "2026-11-02", status: "present", tasks: [], idle_hours: 0, idle_reason: "", today: "2026-11-01" }),
    "Cannot fill timesheet for a future date",
  );
  assert.equal(
    validateTimesheet({
      date: "2026-11-01",
      status: "present",
      tasks: [{ category: "Core Activity", hours: 20, note: "" }],
      idle_hours: 5,
      idle_reason: "travel",
      today: "2026-11-01",
    }),
    "Total hours (incl. idle) cannot exceed 24 in a day",
  );
  const ok = validateTimesheet({
    date: "2026-11-01",
    status: "present",
    tasks: [
      { category: "Core Activity", hours: 6, note: "" },
      { category: "Other Activities", hours: 0, note: "   " },
    ],
    idle_hours: 1,
    idle_reason: "sick",
    today: "2026-11-01",
  });
  assert.equal(ok.total, 6);
  assert.equal(ok.kept.length, 1);
  const split = validateTimesheet({
    date: "2026-11-01",
    status: "half_day",
    tasks: [
      { category: "Core Activity", hours: 2, note: "standup" },
      { category: "Core Activity", hours: 2, note: "spec" },
    ],
    idle_hours: 0,
    idle_reason: "",
    today: "2026-11-01",
  });
  assert.equal(split.total, 4);
  assert.equal(split.kept.length, 2);
  assert.equal(split.kept[0].note, "standup");
  assert.equal(split.kept[1].note, "spec");
});

test("admin export includes every other active person", () => {
  const users = [
    { id: "a", name: "Admin", reports_to: null },
    { id: "b", name: "Lead", reports_to: "a" },
    { id: "c", name: "IC", reports_to: "b" },
    { id: "d", name: "Peer", reports_to: "a" },
  ];
  assert.deepEqual(exportScope(users, "b", "employee").map((u) => u.id), ["c"]);
  assert.deepEqual(exportScope(users, "a", "admin").map((u) => u.id).sort(), ["b", "c", "d"]);
  const dotted = [
    { id: "mgr", reports_to: null },
    { id: "direct", reports_to: "mgr" },
    { id: "dotted", reports_to: "other", also_reports_to: ["mgr"] },
  ];
  assert.deepEqual(exportScope(dotted, "mgr", "employee").map((u) => u.id).sort(), ["direct", "dotted"]);
});

test("excel rows and workbook contain both sheets", () => {
  const row = timesheetDetailRow({
    user_name: "Sanjay",
    date: "2026-10-31",
    status: "present",
    tasks: [{ category: "Core Activity", hours: 4 }, { category: "Ad-hoc Activity assigned by team", hours: 1.5 }],
    idle_hours: 0.5,
    idle_reason: "",
    total_hours: 5.5,
    achievements: "Shipped",
    approval_status: "pending",
    comments: "",
  });
  assert.equal(row[3], 4);
  assert.equal(row[4], 1.5);
  assert.equal(row[2], "Present");
  assert.match(row[6], /Core Activity: 4h/);
  assert.match(row[6], /Ad-hoc Activity assigned by team: 1.5h/);
  const activities = activityRows([{
    user_name: "Sanjay",
    date: "2026-10-31",
    status: "present",
    approval_status: "pending",
    tasks: [
      { category: "Core Activity", hours: 2, note: "standup" },
      { category: "Core Activity", hours: 2, note: "spec" },
    ],
  }]);
  assert.equal(activities.length, 2);
  assert.equal(activities[0][4], 2);
  assert.equal(activities[1][5], "spec");
  const review = reviewRow({
    user_name: "Sanjay",
    period_type: "weekly",
    period_label: "2026-W44",
    content: "Shipped",
    status: "approved",
    chain: [{ name: "Abhimanyu", action: "approved", comment: "ok" }],
    created_at: "2026-10-31T10:00:00+05:30",
  });
  assert.equal(review[1], "Weekly");
  assert.match(review[5], /Approved by Abhimanyu: ok/);
  const feedback = feedbackRow({
    user_name: "Sanjay",
    subject: "Tools",
    message: "Need access",
    status: "open",
    history: [],
    created_at: "2026-10-31T10:00:00+05:30",
  });
  assert.equal(feedback[1], "Tools");
  assert.equal(feedback[5], "2026-10-31");
  const summary = summaryRow({ id: "u1", name: "Sanjay" }, [
    { user_id: "u1", status: "present", total_hours: 5.5, idle_hours: 0.5 },
    { user_id: "u1", status: "half_day", total_hours: 4, idle_hours: 0 },
    { user_id: "u1", status: "leave", total_hours: 0, idle_hours: 0 },
  ]);
  assert.deepEqual(summary, ["Sanjay", 1, 1, 0, 1, 9.5, 0.5]);
  const bytes = buildXlsx([
    { name: "Timesheets", headers: ["Employee"], rows: [row], widths: [18] },
    { name: "Summary", headers: ["Employee"], rows: [summary], widths: [18] },
  ]);
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /Timesheets/);
  assert.match(text, /Summary/);
  assert.match(text, /FF0F172A/);
  assert.match(text, /Sanjay/);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
});

test("overdue timesheets list only people missing more than 3 working days", () => {
  const today = "2026-11-12";
  const people = [
    { id: "asha", name: "Asha", created_at: "2026-01-01T00:00:00+05:30" },
    { id: "dev", name: "Dev", created_at: "2026-01-01T00:00:00+05:30" },
    { id: "new", name: "New Hire", created_at: "2026-11-11T02:00:00.000Z" },
    { id: "blank", name: "Blank", created_at: "2026-11-06T00:00:00+05:30" },
  ];
  const filled = [
    { user_id: "asha", date: "2026-11-07" },
    { user_id: "dev", date: "2026-11-09" },
    { user_id: "new", date: "2026-11-06" },
  ];
  const alerts = overdueTimesheets(people, filled, today);
  assert.deepEqual(
    alerts.map((alert) => [alert.name, alert.days]),
    [
      ["Blank", ["2026-11-06", "2026-11-07", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]],
      ["Asha", ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]],
    ],
  );
});

test("jwt expires and rejects a bad signature", async () => {
  const token = await signJwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) + 60, type: "access" }, "secret");
  const payload = await verifyJwt(token, "secret");
  assert.equal(payload.sub, "user-1");
  await assert.rejects(() => verifyJwt(token, "other"), /invalid/);
  const expired = await signJwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) - 10, type: "access" }, "secret");
  await assert.rejects(() => verifyJwt(expired, "secret"), /expired/);
});
