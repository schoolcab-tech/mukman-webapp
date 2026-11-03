"""Copy an existing Mukman Mongo database into the Supabase tables.

The SQL migration already inserts the starter employees and content.
This script keeps those rows and adds anything else that is in Mongo
(extra people, timesheets, reviews, feedback, notifications).

Usage:
  MONGO_URL=mongodb://127.0.0.1:27017 DB_NAME=mukman \\
  SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \\
  python supabase/scripts/migrate_mongo.py
"""

import json
import os
import urllib.error
import urllib.request
import uuid

from pymongo import MongoClient

NAMESPACE = uuid.UUID("6f0c9a3e-9c1d-4e3a-8b7a-1d2e3f4a5b6c")


def oid(value):
    if value is None:
        return None
    return str(uuid.uuid5(NAMESPACE, str(value)))


def rest(method, path, body=None, prefer=None):
    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/" + path
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    req.add_header("authorization", "Bearer " + os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    req.add_header("content-type", "application/json")
    if prefer:
        req.add_header("prefer", prefer)
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode()
        raise SystemExit(f"{method} {path} failed: {exc.code} {detail}") from exc


def main():
    mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017"))
    db = mongo[os.environ.get("DB_NAME", "mukman")]
    existing = {row["email"]: row["id"] for row in rest("GET", "users?select=id,email")}
    id_map = {}

    for user in db.users.find({}):
        email = str(user.get("email", "")).strip().lower()
        if not email:
            continue
        mapped = existing.get(email) or oid(user["_id"])
        id_map[str(user["_id"])] = mapped
        if email in existing:
            continue
        also = [id_map.get(str(item)) or oid(item) for item in user.get("also_reports_to") or []]
        rest("POST", "users", {
            "id": mapped,
            "name": user.get("name") or email,
            "email": email,
            "phone": user.get("phone") or "",
            "password_hash": user.get("password_hash") or "",
            "title": user.get("title") or "",
            "department": user.get("department") or "",
            "reports_to": id_map.get(str(user.get("reports_to"))) if user.get("reports_to") else None,
            "role": user.get("role") if user.get("role") in ("admin", "employee") else "employee",
            "esop_applicable": bool(user.get("esop_applicable")),
            "active": user.get("active", True) is not False,
            "must_change_password": bool(user.get("must_change_password")),
            "slack_id": user.get("slack_id") or "",
            "also_reports_to": [item for item in also if item],
            "created_at": user.get("created_at"),
        }, "return=minimal")
        existing[email] = mapped

    def user_id(value):
        if not value:
            return None
        return id_map.get(str(value)) or oid(value)

    copied = {"timesheets": 0, "reviews": 0, "feedback": 0, "notifications": 0}
    for sheet in db.timesheets.find({}):
        rest("POST", "timesheets?on_conflict=user_id,date", {
            "id": oid(sheet["_id"]),
            "user_id": user_id(sheet.get("user_id")),
            "user_name": sheet.get("user_name") or "",
            "date": sheet.get("date"),
            "status": sheet.get("status"),
            "tasks": sheet.get("tasks") or [],
            "idle_hours": sheet.get("idle_hours") or 0,
            "idle_reason": sheet.get("idle_reason") or "",
            "hours": sheet.get("hours") or 0,
            "total_hours": sheet.get("total_hours") or sheet.get("hours") or 0,
            "achievements": sheet.get("achievements") or "",
            "approval_status": sheet.get("approval_status") or "pending",
            "approver_id": user_id(sheet.get("approver_id")),
            "comments": sheet.get("comments") or "",
            "created_at": sheet.get("created_at"),
            "reviewed_at": sheet.get("reviewed_at"),
            "reviewed_by": user_id(sheet.get("reviewed_by")),
        }, "resolution=merge-duplicates,return=minimal")
        copied["timesheets"] += 1

    for review in db.reviews.find({}):
        rest("POST", "reviews", {
            "id": oid(review["_id"]),
            "user_id": user_id(review.get("user_id")),
            "user_name": review.get("user_name") or "",
            "period_type": review.get("period_type"),
            "period_label": review.get("period_label") or "",
            "content": review.get("content") or "",
            "status": review.get("status") or "pending",
            "current_approver_id": user_id(review.get("current_approver_id")),
            "chain": review.get("chain") or [],
            "created_at": review.get("created_at"),
        }, "return=minimal")
        copied["reviews"] += 1

    for item in db.feedback.find({}):
        rest("POST", "feedback", {
            "id": oid(item["_id"]),
            "user_id": user_id(item.get("user_id")),
            "user_name": item.get("user_name") or "",
            "subject": item.get("subject") or "",
            "message": item.get("message") or "",
            "status": item.get("status") or "open",
            "current_owner_id": user_id(item.get("current_owner_id")),
            "history": item.get("history") or [],
            "created_at": item.get("created_at"),
        }, "return=minimal")
        copied["feedback"] += 1

    for note in db.notifications.find({}):
        rest("POST", "notifications", {
            "id": oid(note["_id"]),
            "user_id": user_id(note.get("user_id")),
            "type": note.get("type") or "status_update",
            "title": note.get("title") or "",
            "message": note.get("message") or "",
            "channel": note.get("channel") or "in_app",
            "popup": bool(note.get("popup")),
            "read": bool(note.get("read")),
            "created_at": note.get("created_at"),
        }, "return=minimal")
        copied["notifications"] += 1

    print("copied", copied)


if __name__ == "__main__":
    main()
