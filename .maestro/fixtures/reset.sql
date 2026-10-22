-- Maestro fixtures (local / staging only). Run through fixtures/reset.sh, which fills the psql
-- variables below from the environment: company, tech (user id), tech_name, today (ISO timestamp).
-- Idempotent: removes earlier Maestro jobs, then inserts three pending jobs for the technician.
begin;

delete from public.notifications where job_id in (select id from public.jobs where client_name like 'Maestro %');
delete from public.job_messages where job_id in (select id from public.jobs where client_name like 'Maestro %');
delete from public.job_activity_logs where job_id in (select id from public.jobs where client_name like 'Maestro %');
delete from public.jobs where company_id = :'company' and client_name like 'Maestro %';

insert into public.jobs (company_id, client_name, client_first_name, client_last_name, client_phone, client_address, job_details, service_type, category, status, priority, assigned_to, assigned_user_id, scheduled_date, duration_minutes, created_by)
values
  (:'company', 'Maestro Fixture',  'Maestro', 'Fixture',  '+15550100001', '12 Test Lane, Springfield', 'Thermostat replacement (E2E: technician completes the job)', 'HVAC', 'Repair', 'pending', 'medium', :'tech_name', :'tech', (:'today')::timestamptz + interval '1 hour', 90, :'owner'),
  (:'company', 'Maestro Reassign', 'Maestro', 'Reassign', '+15550100002', '34 Test Lane, Springfield', 'Water heater inspection (E2E: dispatcher reassigns)',          'Plumbing', 'Inspection', 'pending', 'medium', :'tech_name', :'tech', (:'today')::timestamptz + interval '3 hours', 60, :'owner'),
  (:'company', 'Maestro Offline',  'Maestro', 'Offline',  '+15550100003', '56 Test Lane, Springfield', 'Outlet repair (E2E: offline status change syncs)',          'Electrical', 'Repair', 'pending', 'low', :'tech_name', :'tech', (:'today')::timestamptz + interval '5 hours', 45, :'owner');

commit;
