-- Corrige RLS de plano_livros: separa em políticas por operação
-- Execute no SQL Editor do Supabase Dashboard

drop policy if exists "plano_livros_own" on public.plano_livros;
drop policy if exists "plano_livros_select" on public.plano_livros;
drop policy if exists "plano_livros_insert" on public.plano_livros;
drop policy if exists "plano_livros_update" on public.plano_livros;
drop policy if exists "plano_livros_delete" on public.plano_livros;

create policy "plano_livros_select" on public.plano_livros
  for select using (
    exists (
      select 1 from public.planos_mensais p
      where p.id = plano_livros.plano_id
        and p.user_id = auth.uid()
    )
  );

create policy "plano_livros_insert" on public.plano_livros
  for insert with check (
    exists (
      select 1 from public.planos_mensais p
      where p.id = plano_livros.plano_id
        and p.user_id = auth.uid()
    )
  );

create policy "plano_livros_update" on public.plano_livros
  for update using (
    exists (
      select 1 from public.planos_mensais p
      where p.id = plano_livros.plano_id
        and p.user_id = auth.uid()
    )
  );

create policy "plano_livros_delete" on public.plano_livros
  for delete using (
    exists (
      select 1 from public.planos_mensais p
      where p.id = plano_livros.plano_id
        and p.user_id = auth.uid()
    )
  );
