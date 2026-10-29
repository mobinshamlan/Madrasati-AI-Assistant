-- The provider that actually handled an attempt is known only after the Python backend answers.
-- Let the operator record it (column privilege only; the row policies are unchanged).
grant update (provider) on public.dispatch_attempts to authenticated;
