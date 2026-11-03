-- Mukman internal portal. Replaces the MongoDB collections in backend/server.py.
-- Passwords are the same starter passwords that server.py seeded.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text not null default '',
  password_hash text not null,
  title text not null default '',
  department text not null default '',
  reports_to uuid references public.users (id) on delete set null,
  role text not null default 'employee' check (role in ('admin', 'employee')),
  esop_applicable boolean not null default false,
  active boolean not null default true,
  must_change_password boolean not null default false,
  slack_id text not null default '',
  also_reports_to uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index users_phone_idx on public.users (phone);
create index users_reports_to_idx on public.users (reports_to);

create table public.content (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  body text not null,
  stats jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null
);

create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  user_name text not null default '',
  date date not null,
  status text not null check (status in ('present', 'absent', 'leave')),
  tasks jsonb not null default '[]'::jsonb,
  idle_hours double precision not null default 0,
  idle_reason text not null default '',
  hours double precision not null default 0,
  total_hours double precision not null default 0,
  achievements text not null default '',
  approval_status text not null check (approval_status in ('pending', 'approved', 'rejected')),
  approver_id uuid references public.users (id) on delete set null,
  comments text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users (id) on delete set null,
  unique (user_id, date)
);

create index timesheets_approver_idx on public.timesheets (approver_id, approval_status);
create index timesheets_date_idx on public.timesheets (date);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  user_name text not null default '',
  period_type text not null check (period_type in ('weekly', 'monthly', 'quarterly', 'annual')),
  period_label text not null,
  content text not null,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  current_approver_id uuid references public.users (id) on delete set null,
  chain jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index reviews_user_idx on public.reviews (user_id, created_at desc);
create index reviews_approver_idx on public.reviews (current_approver_id, status);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  user_name text not null default '',
  subject text not null,
  message text not null,
  status text not null check (status in ('open', 'forwarded', 'resolved')),
  current_owner_id uuid references public.users (id) on delete set null,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index feedback_user_idx on public.feedback (user_id, created_at desc);
create index feedback_owner_idx on public.feedback (current_owner_id, status);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  channel text not null default 'in_app',
  popup boolean not null default false,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.penalty_rules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text not null,
  percent double precision not null,
  applies_to text not null,
  enabled boolean not null default true
);

create table public.org_nodes (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  title text not null default '',
  kind text not null default 'open',
  parent_email text not null
);

create table public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  run_id text not null unique,
  job text not null,
  at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.content enable row level security;
alter table public.timesheets enable row level security;
alter table public.reviews enable row level security;
alter table public.feedback enable row level security;
alter table public.notifications enable row level security;
alter table public.penalty_rules enable row level security;
alter table public.org_nodes enable row level security;
alter table public.cron_runs enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute $revoke$
      revoke all on table
        public.users, public.content, public.timesheets, public.reviews, public.feedback,
        public.notifications, public.penalty_rules, public.org_nodes, public.cron_runs
      from anon, authenticated
    $revoke$;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute $grant$
      grant all on table
        public.users, public.content, public.timesheets, public.reviews, public.feedback,
        public.notifications, public.penalty_rules, public.org_nodes, public.cron_runs
      to service_role
    $grant$;
  end if;
end $$;

insert into public.users (
  name, email, phone, password_hash, title, department, reports_to, role, esop_applicable, active
) values (
  'Pankaj Talan',
  'mukman.technologies@gmail.com',
  '9000000001',
  extensions.crypt('Mukman@2026', extensions.gen_salt('bf')),
  'Founder & CEO',
  'Leadership',
  null,
  'admin',
  true,
  true
);

insert into public.users (
  name, email, phone, password_hash, title, department, reports_to, role, esop_applicable, active, must_change_password
) values
(
  'Abhimanyu', 'abhimanyu@mukman.in', '7807903265',
  extensions.crypt('Schoolcab@1', extensions.gen_salt('bf')),
  'Operations & Technology', 'Operations',
  (select id from public.users where email = 'mukman.technologies@gmail.com'),
  'employee', true, true, true
),
(
  'Charvi', 'charvi@mukman.in', '9811577867',
  extensions.crypt('Schoolcab@1', extensions.gen_salt('bf')),
  'Marketing & Parents', 'Marketing',
  (select id from public.users where email = 'mukman.technologies@gmail.com'),
  'employee', false, true, true
),
(
  'Sanjay', 'sanjay@mukman.in', '9060438347',
  extensions.crypt('Schoolcab@1', extensions.gen_salt('bf')),
  'Technology', 'Tech',
  (select id from public.users where email = 'mukman.technologies@gmail.com'),
  'employee', true, true, true
);

insert into public.users (
  name, email, phone, password_hash, title, department, reports_to, role, esop_applicable, active, must_change_password
) values
(
  'Himanshu', 'himanshu@mukman.in', '9560320353',
  extensions.crypt('Schoolcab@1', extensions.gen_salt('bf')),
  'Fleet Maintenance', 'Fleet Maintenance',
  (select id from public.users where email = 'abhimanyu@mukman.in'),
  'employee', false, true, true
),
(
  'Dipanshu', 'dipanshu@mukman.in', '9220836613',
  extensions.crypt('Schoolcab@1', extensions.gen_salt('bf')),
  'Driver Management', 'Driver Operations',
  (select id from public.users where email = 'abhimanyu@mukman.in'),
  'employee', false, true, true
),
(
  'Miki', 'micky@mukman.in', '9311763047',
  extensions.crypt('Schoolcab@1', extensions.gen_salt('bf')),
  'Collections', 'Collections',
  (select id from public.users where email = 'abhimanyu@mukman.in'),
  'employee', false, true, true
);

insert into public.users (
  name, email, phone, password_hash, title, department, reports_to, role, esop_applicable, active, must_change_password, also_reports_to
) values (
  'Ashish', 'ashish@mukman.in', '9354439610',
  extensions.crypt('Schoolcab@1', extensions.gen_salt('bf')),
  'Attendance, Charging & HSV Global', 'Operations Support',
  (select id from public.users where email = 'himanshu@mukman.in'),
  'employee', false, true, true,
  array[
    (select id from public.users where email = 'dipanshu@mukman.in'),
    (select id from public.users where email = 'abhimanyu@mukman.in')
  ]
);

insert into public.content (key, title, body, updated_by) values (
  'vision',
  'The Mukman Vision',
  $body$Mukman Technologies is building India's leading platform for recurring and fixed-route rides.

While Ola and Uber solved on-demand mobility, nobody owns the rides that happen every single day — the school run, the office commute, the fixed route. We exist to take all the stress out of mobility for people who ride on a regular basis: no daily booking, no waiting for a driver, no inconsistency in who shows up.

Our goal is simple — fix every recurring mobility need in the country and be the most trusted name in scheduled rides.$body$,
  (select id from public.users where email = 'mukman.technologies@gmail.com')
);

insert into public.content (key, title, body, updated_by) values (
  'brand_schoolcab',
  'SchoolCab',
  $body$SchoolCab is our school commute mobility brand. Its broader aim is to fix the entire school commute ecosystem — reducing the risks associated with school travel and giving parents safety, comfort and complete assurance about their child's daily commute.$body$,
  (select id from public.users where email = 'mukman.technologies@gmail.com')
);

insert into public.content (key, title, body, updated_by) values (
  'brand_cabzee',
  'Cabzee',
  $body$Cabzee is our fixed-route office commute brand. It removes the daily stress of booking rides for recurring travel, helps every individual plan their day better, and brings consistency and reliability to the everyday office commute.$body$,
  (select id from public.users where email = 'mukman.technologies@gmail.com')
);

insert into public.content (key, title, body, updated_by) values (
  'brand_advisory',
  'Mukman Advisory',
  $body$Mukman Advisory is the group's financial services arm, working on the financial advisory side of mobility platforms — structuring capital, unit economics and growth strategy for the mobility ecosystem.$body$,
  (select id from public.users where email = 'mukman.technologies@gmail.com')
);

insert into public.content (key, title, body, stats, updated_by) values (
  'achievements',
  'Achievements So Far',
  $body$In the last four months, Mukman Group has moved from idea to operating business:

- Deployed 17 vehicles to the market
- Tied up with 3 schools, generating ₹4 lakh per month in recurring revenue from school commute alone
- Partnered with Milo, a mobility platform, to utilise our vehicle fleet outside school hours
- On path to generate our first crore of annual revenue
- Building parallel demand from office-going professionals for their recurring rides

Every milestone brings us closer to owning the recurring rides category in India.$body$,
  $stats$[{"label":"Vehicles Deployed","value":"17","sub":"in the last 4 months"},{"label":"School Partnerships","value":"3","sub":"signed in 4 months"},{"label":"Recurring Revenue","value":"₹4L/mo","sub":"from school commute"},{"label":"Fleet Partner","value":"Milo","sub":"off-hours utilisation"}]$stats$::jsonb,
  (select id from public.users where email = 'mukman.technologies@gmail.com')
);

insert into public.content (key, title, body, stats, updated_by) values (
  'valuation',
  'Valuation & Market Opportunity',
  $body$Mukman Group is currently targeting a valuation of ₹25 crore, reflecting our deployed fleet of 17 vehicles, signed school contracts and a growing recurring revenue base.

Just our home market tells the story: the addressable market for school-student commute in Delhi alone is ₹12,000 crore. Layer on office commuters travelling fixed routes every single day, and the national recurring-rides opportunity runs into tens of thousands of crores — with no organised category leader today.

As fleet deployment, school tie-ups and office routes scale, we expect this valuation to compound quarter on quarter.$body$,
  $stats$[{"label":"Target Valuation","value":"₹25 Cr","sub":"current target"},{"label":"Delhi School Market","value":"₹12,000 Cr","sub":"addressable, Delhi only"},{"label":"Vehicles Deployed","value":"17","sub":"and scaling"},{"label":"Recurring Revenue","value":"₹4L/mo","sub":"from school commute"}]$stats$::jsonb,
  (select id from public.users where email = 'mukman.technologies@gmail.com')
);

insert into public.content (key, title, body, stats, updated_by) values (
  'benefits',
  'Employee Benefits at MukMan',
  $body$At MukMan, we take care of the people who take care of mobility.

Medical Insurance: Every employee is covered with ₹2 lakh of medical insurance from day one — hospitalisation, day-care procedures and emergency treatment — so nobody worries about medical bills while building the future of mobility.

Weekly Refreshment Activities: Every week we step away from the desk together — team activities, games and outings to recharge and bond as one MukMan family.

Founder Counselling Sessions: Every employee gets direct, open-door counselling sessions with the Founder & CEO — career guidance, personal growth, or anything on your mind.

ESOP Ownership: Eligible team members hold real ownership in the group through the MukMan ESOP pool. Performance, consistency and discipline directly protect and grow that ownership.

Recognition: Consistent performers are recognised in periodic reviews and all-hands — great work never goes unnoticed at MukMan.$body$,
  $stats$[{"label":"Medical Insurance","value":"₹2 Lakh","sub":"from day one"},{"label":"Refreshment Activities","value":"Weekly","sub":"team activities & outings"},{"label":"Founder Counselling","value":"Direct","sub":"open-door sessions"},{"label":"ESOP Pool","value":"Ownership","sub":"for eligible members"}]$stats$::jsonb,
  (select id from public.users where email = 'mukman.technologies@gmail.com')
);

insert into public.penalty_rules (key, label, description, percent, applies_to, enabled) values
(
  'ts_delay_5d',
  'Timesheet delayed 5 days',
  'Continuous delay of 5 days in filling timesheets results in a salary payout decline.',
  10, 'salary', true
),
(
  'ts_delay_10d',
  'Timesheet delayed 10 days',
  'Continuous failure to fill timesheets for 10 days results in a decline in ownership / ESOP percentage (for ESOP-eligible employees).',
  10, 'esop', true
),
(
  'weekly_review_3_missed',
  '3 weekly summaries missed',
  'Missing 3 consecutive weekly summaries triggers a penalty on salary or ownership.',
  10, 'salary', true
),
(
  'monthly_review_2_missed',
  '2 monthly summaries missed',
  'Missing 2 monthly achievement summaries triggers a penalty on salary or ownership.',
  10, 'salary', true
);

insert into public.org_nodes (key, name, title, kind, parent_email) values
(
  'driver_hiring_open', 'Driver Hiring', 'Position open', 'open', 'abhimanyu@mukman.in'
),
(
  'pankaj_finance', 'Pankaj', 'Finance & Accounts', 'hat', 'founder'
);
