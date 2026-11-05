alter table public.timesheets drop constraint if exists timesheets_status_check;
alter table public.timesheets
  add constraint timesheets_status_check
  check (status in ('present', 'half_day', 'absent', 'leave'));
