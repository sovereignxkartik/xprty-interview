-- Apply this corrective migration if the destructive reset has already run.
-- RLS remains enforced for anon/authenticated clients. This only restores
-- server-side access for the Express API's service-role client.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant all privileges on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
