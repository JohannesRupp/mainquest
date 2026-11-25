-- Tasks ohne Quest werden nach Google Tasks gespiegelt; hier steht die Google-ID
alter table public.tasks add column if not exists google_task_id text;
