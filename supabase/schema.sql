-- MainQuest Datenbankschema
-- Im Supabase Dashboard unter "SQL Editor" einmal komplett ausführen.

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  description text,
  color text not null default '#f5b942',
  status text not null default 'active' check (status in ('active', 'done', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  quest_id uuid references public.quests on delete set null,
  title text not null,
  notes text,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  task_id uuid not null references public.tasks on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  google_event_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  calendar_id text not null default 'primary',
  auto_sync boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_idx on public.tasks (user_id, done);
create index if not exists entries_user_idx on public.time_entries (user_id, started_at);
create index if not exists entries_task_idx on public.time_entries (task_id);

-- Nur ein laufender Timer pro Nutzer
create unique index if not exists one_running_timer
  on public.time_entries (user_id) where ended_at is null;

-- Row Level Security: jeder sieht nur seine eigenen Daten
alter table public.quests enable row level security;
alter table public.tasks enable row level security;
alter table public.time_entries enable row level security;
alter table public.user_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['quests', 'tasks', 'time_entries', 'user_settings'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;
