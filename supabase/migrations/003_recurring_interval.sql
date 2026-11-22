-- MainQuest Migration 003: Wiederholung "alle N Tage/Wochen" mit Start- und Enddatum
-- Einmal komplett im Supabase SQL Editor ausführen.

alter table public.recurring_tasks add column if not exists interval_count integer not null default 1 check (interval_count > 0);
alter table public.recurring_tasks add column if not exists unit text not null default 'week' check (unit in ('day', 'week'));
alter table public.recurring_tasks add column if not exists starts_on date not null default current_date;
alter table public.recurring_tasks add column if not exists ends_on date;
