"""Backend API tests for Mukman Technologies internal portal."""
import os
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://mobility-hub-421.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN = {"identifier": "mukman.technologies@gmail.com", "password": "Mukman@2026"}
ABHI = {"identifier": "9000000002", "password": "Mukman@123"}
HIMANSHU = {"identifier": "himanshu@mukman.in", "password": "Mukman@123"}
CRON_SECRET = "mukman-cron-7f3a9c2e5b81d4f6a0c3e7b95d21f486"


def _session(creds=None):
    s = requests.Session()
    if creds:
        r = s.post(f"{API}/auth/login", json=creds, timeout=15)
        assert r.status_code == 200, f"Login failed for {creds['identifier']}: {r.status_code} {r.text}"
    return s


# ---------- Auth ----------
class TestAuth:
    def test_login_admin_email(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json=ADMIN)
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "admin"
        assert data["email"] == ADMIN["identifier"].lower()
        assert "access_token" in s.cookies

    def test_login_phone(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json=ABHI)
        assert r.status_code == 200
        assert r.json()["name"] == "Abhimanyu"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"identifier": "nope@x.in", "password": "wrong"})
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_cookie(self):
        s = _session(ADMIN)
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_logout(self):
        s = _session(ADMIN)
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200


# ---------- Content / Org / Penalty auth ----------
class TestPublicApiRequiresAuth:
    @pytest.mark.parametrize("path", ["/content", "/org-chart", "/penalty-rules", "/notifications"])
    def test_401_no_cookie(self, path):
        r = requests.get(f"{API}{path}")
        assert r.status_code == 401

    def test_content_seeded(self):
        s = _session(ADMIN)
        r = s.get(f"{API}/content")
        assert r.status_code == 200
        keys = r.json().keys()
        for k in ("vision", "brand_schoolcab", "brand_cabzee", "brand_advisory", "achievements", "valuation", "benefits"):
            assert k in keys, f"missing seed key {k}"

    def test_org_chart_hierarchy(self):
        s = _session(ADMIN)
        r = s.get(f"{API}/org-chart")
        assert r.status_code == 200
        users = r.json()
        by_email = {u["name"]: u for u in users}
        assert "Abhimanyu" in by_email
        admin_id = next(u["id"] for u in users if u["role"] == "admin")
        assert by_email["Abhimanyu"]["reports_to"] == admin_id
        assert by_email["Himanshu"]["reports_to"] == by_email["Abhimanyu"]["id"]

    def test_penalty_rules_seeded(self):
        s = _session(ADMIN)
        r = s.get(f"{API}/penalty-rules")
        assert r.status_code == 200
        keys = {p["key"] for p in r.json()}
        assert {"ts_delay_5d", "ts_delay_10d", "weekly_review_3_missed"}.issubset(keys)


# ---------- Cron auth ----------
class TestCron:
    def test_timesheet_reminders_requires_secret(self):
        r = requests.post(f"{API}/cron/timesheet-reminders", json={})
        assert r.status_code == 401

    def test_weekly_review_requires_secret(self):
        r = requests.post(f"{API}/cron/weekly-review-reminder", json={})
        assert r.status_code == 401

    def test_cron_with_secret(self):
        h = {"Authorization": f"Bearer {CRON_SECRET}"}
        r = requests.post(f"{API}/cron/timesheet-reminders", json={"run_id": f"test-{int(time.time())}"}, headers=h)
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ---------- Timesheet flow ----------
class TestTimesheetFlow:
    def test_full_flow(self):
        emp = _session(ABHI)
        admin = _session(ADMIN)
        # Use a unique-per-run date to avoid the "already approved and locked" branch from prior runs.
        # Use a past weekday not yet used; iterate to find one not approved.
        from datetime import date as D, timedelta as TD
        d = D.today() - TD(days=1)
        for _ in range(30):
            r = emp.post(f"{API}/timesheets", json={"date": d.isoformat(), "status": "present", "hours": 8, "achievements": "Test entry"})
            if r.status_code == 200:
                break
            d = d - TD(days=1)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        date = d.isoformat()
        # my
        r = emp.get(f"{API}/timesheets/my")
        assert r.status_code == 200
        assert any(t["id"] == tid for t in r.json())
        # admin sees pending
        r = admin.get(f"{API}/timesheets/approvals")
        assert r.status_code == 200
        assert any(t["id"] == tid for t in r.json()), "Admin should see abhimanyu's pending timesheet"
        # approve
        r = admin.post(f"{API}/timesheets/{tid}/approve", json={"comment": "ok"})
        assert r.status_code == 200, r.text
        # verify status
        r = emp.get(f"{API}/timesheets/my")
        assert next(t for t in r.json() if t["id"] == tid)["approval_status"] == "approved"
        # future date rejected
        r = emp.post(f"{API}/timesheets", json={"date": "2099-01-01", "status": "present"})
        assert r.status_code == 400


# ---------- Review chain-of-command ----------
class TestReviewEscalation:
    def test_review_escalates_to_admin(self):
        # Himanshu submits -> Abhimanyu approves -> escalates to admin -> admin approves final
        himanshu = _session(HIMANSHU)
        abhi = _session(ABHI)
        admin = _session(ADMIN)
        label = f"2026-W{int(time.time()) % 50:02d}"  # unique
        r = himanshu.post(f"{API}/reviews", json={"period_type": "weekly", "period_label": label, "content": "Weekly work"})
        assert r.status_code == 200
        rid = r.json()["id"]
        # abhi sees pending
        r = abhi.get(f"{API}/reviews/pending")
        assert any(rv["id"] == rid for rv in r.json())
        # abhi approves -> should escalate to admin
        r = abhi.post(f"{API}/reviews/{rid}/approve", json={"comment": "good"})
        assert r.status_code == 200
        # admin should see it pending
        r = admin.get(f"{API}/reviews/pending")
        assert any(rv["id"] == rid for rv in r.json()), "Escalation to admin failed"
        # admin approves -> final
        r = admin.post(f"{API}/reviews/{rid}/approve", json={"comment": "final"})
        assert r.status_code == 200
        # verify approved
        r = himanshu.get(f"{API}/reviews/my")
        rv = next(x for x in r.json() if x["id"] == rid)
        assert rv["status"] == "approved"


# ---------- Feedback ----------
class TestFeedback:
    def test_feedback_forward_and_resolve(self):
        him = _session(HIMANSHU)
        abhi = _session(ABHI)
        admin = _session(ADMIN)
        r = him.post(f"{API}/feedback", json={"subject": "TEST_fb", "message": "test msg"})
        assert r.status_code == 200
        fid = r.json()["id"]
        r = abhi.get(f"{API}/feedback/inbox")
        assert any(f["id"] == fid for f in r.json())
        r = abhi.post(f"{API}/feedback/{fid}/forward")
        assert r.status_code == 200
        r = admin.get(f"{API}/feedback/inbox")
        assert any(f["id"] == fid for f in r.json())
        r = admin.post(f"{API}/feedback/{fid}/resolve")
        assert r.status_code == 200


# ---------- Admin content + AI + penalties + broadcast ----------
class TestAdminOperations:
    def test_content_update_admin_only(self):
        emp = _session(ABHI)
        r = emp.put(f"{API}/admin/content/vision", json={"title": "x", "body": "y"})
        assert r.status_code == 403

    def test_content_update(self):
        admin = _session(ADMIN)
        r = admin.put(f"{API}/admin/content/benefits", json={"title": "Employee Benefits", "body": "Updated body TEST"})
        assert r.status_code == 200
        assert r.json()["body"] == "Updated body TEST"
        # get back
        r = admin.get(f"{API}/content")
        assert r.json()["benefits"]["body"] == "Updated body TEST"

    def test_penalty_update(self):
        admin = _session(ADMIN)
        r = admin.put(f"{API}/admin/penalty-rules/ts_delay_5d",
                      json={"percent": 12, "description": "test", "enabled": True})
        assert r.status_code == 200
        assert r.json()["percent"] == 12
        # restore
        admin.put(f"{API}/admin/penalty-rules/ts_delay_5d",
                  json={"percent": 10, "description": "Continuous delay of 5 days in filling timesheets results in a salary payout decline.", "enabled": True})

    def test_broadcast(self):
        admin = _session(ADMIN)
        r = admin.post(f"{API}/admin/broadcast", json={"title": "TEST_broadcast", "message": "hello all"})
        assert r.status_code == 200
        assert r.json()["sent"] >= 1
        # verify notification popup for abhi
        abhi = _session(ABHI)
        r = abhi.get(f"{API}/notifications")
        assert any(n.get("popup") and n.get("title") == "TEST_broadcast" for n in r.json())

    def test_employee_crud(self):
        admin = _session(ADMIN)
        unique = f"TEST_user_{int(time.time())}@mukman.in"
        payload = {"name": "TESTUSER", "email": unique, "phone": f"999{int(time.time())%10000000:07d}",
                   "password": "Mukman@123", "title": "QA", "department": "Test", "reports_to": None,
                   "role": "employee", "esop_applicable": False, "active": True}
        r = admin.post(f"{API}/admin/employees", json=payload)
        assert r.status_code == 200, r.text
        eid = r.json()["id"]
        # login works
        sess = requests.Session()
        r = sess.post(f"{API}/auth/login", json={"identifier": unique, "password": "Mukman@123"})
        assert r.status_code == 200
        # deactivate
        r = admin.put(f"{API}/admin/employees/{eid}", json={**payload, "active": False})
        assert r.status_code == 200
        # login blocked
        r = requests.post(f"{API}/auth/login", json={"identifier": unique, "password": "Mukman@123"})
        assert r.status_code == 403

    def test_ai_enhance(self):
        admin = _session(ADMIN)
        r = admin.post(f"{API}/admin/ai-enhance",
                       json={"text": "We have deployed 17 vehicles.", "section": "achievements", "tone": "corporate"},
                       timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "enhanced" in data
        assert len(data["enhanced"]) > 20


# ---------- Notifications ----------
class TestNotifications:
    def test_read_all(self):
        s = _session(ABHI)
        r = s.post(f"{API}/notifications/read-all")
        assert r.status_code == 200
