create table public.devocional_dia (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  titulo text not null,
  texto text not null,
  created_at timestamptz not null default now()
);

alter table public.devocional_dia enable row level security;

-- Devocional do dia: todos leem (tabela compartilhada, escrita só via service role no cron)
create policy "devocional_dia_read" on public.devocional_dia
  for select using (true);
