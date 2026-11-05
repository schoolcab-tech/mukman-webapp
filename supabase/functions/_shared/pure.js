/** Shared portal rules. Plain JS so Node can test them and the Edge Function can import them. */

export function apiPath(pathname) {
  let p = pathname || "/";
  const marker = "/functions/v1/api";
  const at = p.indexOf(marker);
  if (at !== -1) p = p.slice(at + marker.length);
  else if (p.startsWith("/api")) p = p.slice(4);
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}

export function readCookie(header, name) {
  if (!header) return "";
  for (const part of String(header).split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return part.slice(idx + 1).trim();
      }
    }
  }
  return "";
}

export function accessCookie(token, maxAge) {
  return [
    `access_token=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Path=/",
    `Max-Age=${maxAge}`,
  ].join("; ");
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export function istDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function weekdayMonday0(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const sun0 = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (sun0 + 6) % 7;
}

export function weeklyLabel(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

export function monthBounds(month) {
  if (!/^\d{4}-\d{2}$/.test(month || "")) return null;
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

export function periodRange(period, today, start, end) {
  if (period === "week") return { s: addDays(today, -weekdayMonday0(today)), e: today };
  if (period === "month") return { s: `${today.slice(0, 7)}-01`, e: today };
  if (period === "ytd") return { s: `${today.slice(0, 4)}-01-01`, e: today };
  if (period === "custom" && start && end && start <= end) return { s: start, e: end };
  return null;
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function validateTimesheet({ date, status, tasks, idle_hours, idle_reason, today }) {
  if (!date || date > today) return "Cannot fill timesheet for a future date";
  if (!["present", "half_day", "absent", "leave"].includes(status)) return "Invalid status";
  const kept = (Array.isArray(tasks) ? tasks : []).filter(
    (t) => Number(t.hours) > 0 || String(t.note || "").trim(),
  );
  const total = round2(kept.reduce((s, t) => s + (Number(t.hours) || 0), 0));
  const idle = Number(idle_hours) || 0;
  if ((status === "present" || status === "half_day") && total + idle > 24) return "Total hours (incl. idle) cannot exceed 24 in a day";
  if (idle > 0 && !String(idle_reason || "").trim()) return "Please add a reason for idle hours";
  return { kept: kept.map((t) => ({ category: String(t.category || ""), hours: Number(t.hours) || 0, note: String(t.note || "") })), total, idle };
}

export function exportScope(users, userId, role) {
  const children = new Map();
  for (const u of users) {
    if (!u.reports_to) continue;
    const key = String(u.reports_to);
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(u);
  }
  const scope = [];
  const stack = [...(children.get(String(userId)) || [])];
  while (stack.length) {
    const u = stack.pop();
    scope.push(u);
    stack.push(...(children.get(String(u.id)) || []));
  }
  if (role === "admin") {
    const have = new Set(scope.map((u) => String(u.id)));
    for (const u of users) {
      if (!have.has(String(u.id)) && String(u.id) !== String(userId)) scope.push(u);
    }
  }
  return scope;
}

export function catHours(tasks, prefix) {
  return round2(
    (tasks || [])
      .filter((t) => String(t.category || "").startsWith(prefix))
      .reduce((s, t) => s + (Number(t.hours) || 0), 0),
  );
}

function titleWord(value) {
  const v = String(value || "");
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "";
}

export function statusLabel(value) {
  if (value === "half_day") return "Half day";
  return titleWord(value);
}

export function activityLines(tasks) {
  return (tasks || [])
    .filter((t) => Number(t.hours) > 0 || String(t.note || "").trim())
    .map((t) => `${t.category || "Activity"}: ${Number(t.hours) || 0}h — ${String(t.note || "").trim()}`.replace(/ — $/, ""))
    .join("\n");
}

export const TIMESHEET_HEADERS = [
  "Employee",
  "Date",
  "Status",
  "Core Activity (h)",
  "Ad-hoc Activity (h)",
  "Other Activities (h)",
  "Activities",
  "Idle (h)",
  "Idle Reason",
  "Total Utilised (h)",
  "Achievements / Notes",
  "Approval Status",
  "Manager Comment",
];

export const SUMMARY_HEADERS = ["Employee", "Present Days", "Half day", "Absent", "Leave", "Total Utilised (h)", "Idle (h)"];

export const TIMESHEET_WIDTHS = [18, 12, 12, 16, 18, 18, 42, 9, 28, 16, 36, 14, 24];
export const SUMMARY_WIDTHS = [18, 13, 11, 9, 9, 18, 9];

export function timesheetDetailRow(entry) {
  return [
    entry.user_name || "",
    entry.date || "",
    statusLabel(entry.status),
    catHours(entry.tasks, "Core"),
    catHours(entry.tasks, "Ad-hoc"),
    catHours(entry.tasks, "Other"),
    activityLines(entry.tasks),
    Number(entry.idle_hours) || 0,
    entry.idle_reason || "",
    Number(entry.total_hours ?? entry.hours ?? 0),
    entry.achievements || "",
    titleWord(entry.approval_status),
    entry.comments || "",
  ];
}

export function summaryRow(user, entries) {
  const mine = entries.filter((en) => String(en.user_id) === String(user.id));
  return [
    user.name,
    mine.filter((en) => en.status === "present").length,
    mine.filter((en) => en.status === "half_day").length,
    mine.filter((en) => en.status === "absent").length,
    mine.filter((en) => en.status === "leave").length,
    round2(mine.reduce((s, en) => s + Number(en.total_hours ?? en.hours ?? 0), 0)),
    round2(mine.reduce((s, en) => s + Number(en.idle_hours || 0), 0)),
  ];
}

function b64urlEncode(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(text) {
  const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret, use) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [use]);
}

export async function signJwt(payload, secret) {
  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret, "sign");
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`)));
  return `${header}.${body}.${b64urlEncode(sig)}`;
}

export async function verifyJwt(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    const err = new Error("invalid");
    throw err;
  }
  const [h, b, s] = parts;
  const key = await hmacKey(secret, "verify");
  const ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(s), new TextEncoder().encode(`${h}.${b}`));
  if (!ok) throw new Error("invalid");
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(b)));
  if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) throw new Error("expired");
  return payload;
}

export function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const ba = enc.encode(String(a));
  const bb = enc.encode(String(b));
  if (ba.length !== bb.length || ba.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts) {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const data = file.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    locals.push(local, data);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const centralBytes = concat(centrals);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralBytes.length, true);
  ev.setUint32(16, offset, true);
  return concat([...locals, centralBytes, end]);
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colName(n) {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function cellXml(ref, value, style) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function sheetXml(headers, rows, widths) {
  const cols = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("");
  const all = [headers, ...rows];
  const body = all
    .map((row, r) => {
      const cells = row
        .map((value, c) => cellXml(`${colName(c + 1)}${r + 1}`, value, r === 0 ? 1 : 0))
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols>${cols}</cols>
<sheetData>${body}</sheetData>
</worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
</cellXfs>
</styleSheet>`;

function utf8(text) {
  return new TextEncoder().encode(text);
}

export function buildXlsx(sheets) {
  const files = [
    {
      name: "[Content_Types].xml",
      data: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
</Types>`),
    },
    {
      name: "_rels/.rels",
      data: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    },
    {
      name: "xl/workbook.xml",
      data: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${sheets.map((sheet, i) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}
</sheets>
</workbook>`),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    },
    { name: "xl/styles.xml", data: utf8(STYLES_XML) },
    ...sheets.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: utf8(sheetXml(sheet.headers, sheet.rows, sheet.widths)),
    })),
  ];
  return zipStore(files);
}

export const AI_SYSTEM = [
  "You are the corporate communications writer for Mukman Technologies' internal employee portal. ",
  "Mukman Group is a mobility holding company (SchoolCab: school commute, Cabzee: fixed-route office commute, ",
  "Mukman Advisory: financial services). Rewrite the rough draft into polished, professional, inspiring intranet content. ",
  "Expand thin one-liners into rich content: add context, explain terms, and why it matters to employees. ",
  "Keep every factual number, name and figure EXACTLY as given. Never invent new numbers. ",
  "If the section is 'valuation', additionally sense-check that the market-size framing is coherent and clearly explain ",
  "the valuation figures chosen. Use short paragraphs. Return ONLY the enhanced text, no preamble.",
].join("");

export const AI_MODELS = {
  "gpt-5.4": "openai",
  "gpt-5.4-mini": "openai",
  "claude-sonnet-5": "anthropic",
  "claude-sonnet-4-6": "anthropic",
};
