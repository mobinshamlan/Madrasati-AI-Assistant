-- Automatic dispatch of saved schedules. Additive: nothing reads these columns until the scheduler is switched on.
alter table public.notifications
  -- Set when the scheduler claims an update; a claim that never produced an attempt can be released safely.
  add column auto_claimed_at timestamptz,
  -- This update went out inside another update's summary, so it has no attempt of its own.
  add column covered_by uuid references public.notifications (id);

alter table public.dispatch_attempts
  add column triggered_by text not null default 'operator' check (triggered_by in ('operator', 'scheduler'));

create index notifications_pending_idx on public.notifications (status, due_at) where status in ('waiting', 'ready', 'suppressed');
