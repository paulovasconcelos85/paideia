-- Reações em posts do Clube de Leitura
create table public.clube_reacoes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  post_tipo  text not null check (post_tipo in ('pensamento', 'citacao', 'prosa')),
  post_id    uuid not null,
  emoji      text not null check (emoji in ('👍', '✝️', '🔥', '💡')),
  created_at timestamptz not null default now(),
  unique (user_id, post_tipo, post_id, emoji)
);

alter table public.clube_reacoes enable row level security;

-- Qualquer autenticado pode ver reações
create policy "clube_reacoes_select" on public.clube_reacoes
  for select to authenticated using (true);

-- Usuário insere apenas suas próprias reações
create policy "clube_reacoes_insert" on public.clube_reacoes
  for insert to authenticated with check (auth.uid() = user_id);

-- Usuário remove apenas suas próprias reações
create policy "clube_reacoes_delete" on public.clube_reacoes
  for delete to authenticated using (auth.uid() = user_id);
