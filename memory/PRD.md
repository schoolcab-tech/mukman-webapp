# Mukman Group Internal Portal — PRD

## Original Problem Statement
Mukman Technologies is a holding group (SchoolCab — school commute, Cabzee — fixed-route office commute, Mukman Advisory — financial services) with the vision of owning recurring/fixed-route rides in India. They needed an internal employee portal: login-gated homepage presenting group vision & brands, editable content sections (achievements, valuation, benefits), daily timesheets with senior approval + penalty-backed WhatsApp reminders, weekly/monthly/quarterly/annual reviews with chain-of-command approval, employee feedback escalation, org chart, and an admin panel (employee + hierarchy management, AI-enhanced content editing, configurable penalty % rules, broadcast popups).

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`), MongoDB (motor) via MONGO_URL/DB_NAME, JWT auth (bcrypt, httpOnly cookie, 7-day token), `/api` prefix. AI content enhancement via emergentintegrations + OpenAI gpt-5.4 (EMERGENT_LLM_KEY).
- **Frontend**: React 19 + Tailwind + shadcn (`/app/frontend/src/`), Outfit/IBM Plex Sans typography, slate/cyan enterprise theme per `/app/design_guidelines.json`.
- **Scheduling**: `.emergent/crons.yml` — daily 7pm IST timesheet reminder + Tuesday 10am IST weekly-review nudge, both bearer-protected (`WEBHOOK_CRON_SECRET`), idempotent via `cron_runs`.
- **Tests**: `/app/backend/tests/backend_test.py` (26 pytest cases, all passing).

## User Personas
- **Founder/Admin** (mukman.technologies@gmail.com): manages employees, hierarchy, content, penalty rules, broadcasts; final approver.
- **Manager/Approver** (e.g. Abhimanyu): approves timesheets/reviews/feedback of reportees, escalates upward.
- **Employee** (Himanshu, Dipanshu, Micky, Charvi, Sanjay…): fills timesheets, reviews, feedback; consumes portal content.

## Core Requirements (static)
1. Employee login (phone or email + password), admin-issued credentials
2. Editable vision/brand/achievements/valuation/benefits content (admin CMS)
3. AI-enhanced admin content writing (OpenAI gpt-5.4)
4. Daily timesheet with calendar, achievements log, senior approval
5. Periodic reviews (W/M/Q/Y) with escalation up the reporting chain
6. Penalty rules (configurable %, salary vs ESOP) + reminder notifications (WhatsApp mocked in-app)
7. Org chart auto-derived from hierarchy
8. Feedback with forward-to-senior escalation
9. Broadcast popup announcements
10. Employee lifecycle management (add/edit/deactivate, ESOP flag)

## Implemented (2026-09-06)
- Full auth (JWT cookie, email OR phone login, admin seed + 6 seeded employees with real hierarchy)
- Dashboard: vision hero, achievement stat cards, 3 brand cards with imagery, people strip
- Content pages: Valuation, Achievements, Benefits (stats + body, admin-editable)
- Timesheet: month calendar with color-coded states (approved/pending/rejected/missing), entry dialog, approval inbox for managers, penalty rule cards
- Reviews: submit + my reviews + approvals tabs, chain-of-command escalation to founder, audit chain display
- Feedback: submit, inbox for seniors, forward upward, resolve
- Org Chart: full hierarchy tree with department filters
- Notification Hub: tabs (All/Approvals/System/Broadcasts), WhatsApp-mock badges, mark-all-read
- Admin Console: Content & AI editor (tone selector, enhance + publish), Employee CRUD + manager mapping + ESOP flag + deactivate, Penalty rules editor (%, description, enable), Broadcast popup sender
- Crons: daily timesheet reminder + weekly review nudge (verified working, idempotent, 401 without secret)
- Testing: 26/26 backend pytest pass; full frontend E2E pass (1 fixed ObjectId serialization bug in review chains)

## Iteration 2 (2026-09-08)
- Valuation updated: target ₹25 Cr, Delhi school-student addressable market ₹12,000 Cr (stats + body)
- Benefits rewritten "at MukMan": ₹2L medical insurance, weekly refreshment activities, founder counselling sessions, ESOP, recognition (removed test content)
- Org chart rebuilt to match actual structure: Pankaj Talan (Founder & CEO) top → Abhimanyu middle → single peer line (Charvi, Driver Hiring [open position, virtual node], Himanshu, Dipanshu, Miki, Sanjay, Vishnu, Pankaj [Finance & Accounts hat]) with extended founder lines; Ashish dual-reporting under Himanshu & Dipanshu (dashed shared-report connectors); virtual nodes stored in `org_nodes` collection
- Team updates: Micky→Miki, titles synced to chart, added Vishnu (Technology) and Ashish (Attendance, Charging & HSV Global); `also_reports_to` field for shared reporting
- Timesheet redesigned: task-wise rows (Core Activity / Ad-hoc Activity assigned by team / Other Activities dropdowns) each with hours + note, idle hours row, auto-calculated total utilisation bar; approver sees full task breakdown table
- Fixed ObjectId serialization for list fields (`also_reports_to`)

## MOCKED Integrations
- **WhatsApp notifications are MOCKED**: stored as in-app notifications with channel='whatsapp_mock'. Real Twilio WhatsApp dispatch is the upgrade path.

## Backlog / Next Tasks
- P0: Real WhatsApp via Twilio when credentials are provided
- P1: Actual penalty enforcement engine (auto-count consecutive misses → apply/mark salary & ESOP deductions)
- P1: Password reset / forgot-password flow; employee self-service password change
- P2: Brute-force login lockout (5-fail/15-min), split server.py into routers, lifespan handler instead of on_event
- P2: Timesheet export CSV/PDF; review KPI scoring; valuation charts (recharts) with history tracking
- P2: Real-time notifications (websockets) instead of on-load fetch
