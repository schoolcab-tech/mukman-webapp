import axios from "axios";

// Unset on Vercel so requests stay on this site at /api, which proxies to Supabase.
// Set to http://localhost:8000 for the Python API, or the local functions URL for Supabase.
const root = process.env.REACT_APP_BACKEND_URL ?? "";
const headers = {};
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
if (anonKey) {
  headers.apikey = anonKey;
  headers.Authorization = `Bearer ${anonKey}`;
}

const api = axios.create({
  baseURL: `${root}/api`,
  withCredentials: true,
  headers,
});

export function errText(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;
