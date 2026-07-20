-- Registro fotográfico nos fragmentos do Caderno

alter table public.pensamentos
  add column if not exists imagem_url text;

-- Bucket público para as imagens dos fragmentos
insert into storage.buckets (id, name, public)
values ('fragmentos', 'fragmentos', true)
on conflict (id) do nothing;

-- Cada usuário só sobe/apaga arquivos dentro da própria pasta (primeiro segmento do path = seu user_id)
create policy "fragmentos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fragmentos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "fragmentos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fragmentos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Leitura pública (bucket público, usado no Clube)
create policy "fragmentos_select_public" on storage.objects
  for select to public
  using (bucket_id = 'fragmentos');
