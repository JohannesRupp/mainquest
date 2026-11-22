-- MainQuest Migration 002: Tagesplanung, Sortierung, wiederkehrende Tasks, Wochenziele
-- Einmal komplett im Supabase SQL Editor ausführen.

-- Tasks: Tag + Reihenfolge
alter table public.tasks add column if not exists scheduled_on date;
alter table public.tasks add column if not exists position double precision;

update public.tasks
set scheduled_on = coalesce((done_at at time zone 'Europe/Berlin')::date, (now() at time zone 'Europe/Berlin')::date)
where scheduled_on is null;

update public.tasks t
set position = s.rn
from (select id, row_number() over (partition by user_id order by created_at) as rn from public.tasks) s
where t.id = s.id and t.position is null;

alter table public.tasks alter column scheduled_on set default current_date;
alter table public.tasks alter column scheduled_on set not null;
alter table public.tasks alter column position set default 0;
alter table public.tasks alter column position set not null;

create index if not exists tasks_day_idx on public.tasks (user_id, scheduled_on);

-- Wiederkehrende Tasks (Regeln). weekdays: 1 = Montag … 7 = Sonntag
create table if not exists public.recurring_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  quest_id uuid references public.quests on delete set null,
  title text not null,
  weekdays smallint[] not null default '{1,2,3,4,5}',
  generated_until date,
  created_at timestamptz not null default now()
);

alter table public.tasks add column if not exists recurring_id uuid references public.recurring_tasks on delete set null;
create unique index if not exists tasks_recurring_day on public.tasks (recurring_id, scheduled_on);

alter table public.recurring_tasks enable row level security;
drop policy if exists "own rows" on public.recurring_tasks;
create policy "own rows" on public.recurring_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.recurring_tasks to authenticated;

-- Wochenziele in Minuten
alter table public.quests add column if not exists weekly_goal_minutes integer check (weekly_goal_minutes > 0);
alter table public.user_settings add column if not exists weekly_goal_minutes integer check (weekly_goal_minutes > 0);
