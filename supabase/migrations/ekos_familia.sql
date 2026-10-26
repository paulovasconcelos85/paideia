-- Paideia Ekos — família compartilhada, lançamentos reais, patrimônio e dívidas
-- Rode depois de ekos_financas.sql, ekos_planos.sql e ekos_cartoes.sql

-- ─── Família ─────────────────────────────────────────────────────────

create table if not exists public.fin_familias (
  id uuid primary key default gen_random_uuid(),
  nome text not null default 'Nossa família',
  tetos jsonb not null default '{}'::jsonb, -- limite mensal por categoria: { "alimentacao": 1800 }
  created_at timestamptz not null default now()
);

create table if not exists public.fin_membros (
  familia_id uuid not null references public.fin_familias(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('titular', 'membro')),
  created_at timestamptz not null default now(),
  primary key (familia_id, user_id)
);

-- Cada pessoa pertence a uma única família
create unique index if not exists fin_membros_user_unq on public.fin_membros(user_id);

create table if not exists public.fin_convites (
  codigo text primary key,
  familia_id uuid not null references public.fin_familias(id) on delete cascade,
  criado_por uuid not null references auth.users(id) on delete cascade,
  expira_em timestamptz not null default now() + interval '7 days',
  usado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ─── Lançamentos reais, patrimônio e histórico ───────────────────────

create table if not exists public.fin_lancamentos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.fin_familias(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null default current_date,
  competencia date not null, -- primeiro dia do mês em que o gasto pesa (mês da fatura, no cartão)
  descricao text not null,
  valor numeric(12,2) not null, -- negativo = estorno
  categoria text not null default 'outros',
  cartao_id uuid references public.fin_cartoes(id) on delete set null,
  parcela_atual int,
  parcelas_total int,
  origem text not null default 'manual' check (origem in ('manual', 'fatura', 'fixo')),
  despesa_id uuid references public.fin_despesas(id) on delete set null, -- gasto fixo que originou o lançamento
  created_at timestamptz not null default now()
);

create index if not exists fin_lancamentos_comp_idx on public.fin_lancamentos(familia_id, competencia);

create table if not exists public.fin_contas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.fin_familias(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  tipo text not null default 'conta'
    check (tipo in ('conta', 'poupanca', 'reserva', 'investimento', 'dolar', 'bem', 'outro')),
  saldo numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_dividas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.fin_familias(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  tipo text not null default 'outro'
    check (tipo in ('cartao', 'cheque_especial', 'emprestimo', 'consignado', 'financiamento', 'familia', 'outro')),
  saldo numeric(14,2) not null default 0 check (saldo >= 0),
  juros_mensal numeric(6,3) not null default 0 check (juros_mensal >= 0), -- % ao mês
  parcela numeric(12,2) not null default 0 check (parcela >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Retrato mensal do patrimônio, gravado automaticamente ao abrir o app
create table if not exists public.fin_fechamentos (
  familia_id uuid not null references public.fin_familias(id) on delete cascade,
  mes date not null,
  ativos numeric(14,2) not null default 0,
  dividas numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (familia_id, mes)
);

-- ─── Tabelas existentes passam a pertencer à família ─────────────────

alter table public.fin_despesas add column if not exists familia_id uuid references public.fin_familias(id) on delete cascade;
alter table public.fin_rendas   add column if not exists familia_id uuid references public.fin_familias(id) on delete cascade;
alter table public.fin_planos   add column if not exists familia_id uuid references public.fin_familias(id) on delete cascade;
alter table public.fin_cartoes  add column if not exists familia_id uuid references public.fin_familias(id) on delete cascade;

-- Cada usuário que já tem dados vira titular de uma família
do $$
declare
  u uuid;
  f uuid;
begin
  for u in
    select user_id from public.fin_despesas
    union select user_id from public.fin_rendas
    union select user_id from public.fin_planos
    union select user_id from public.fin_cartoes
  loop
    f := null;
    select familia_id into f from public.fin_membros where user_id = u;
    if f is null then
      insert into public.fin_familias default values returning id into f;
      insert into public.fin_membros (familia_id, user_id, papel) values (f, u, 'titular');
    end if;
    update public.fin_despesas set familia_id = f where user_id = u and familia_id is null;
    update public.fin_rendas   set familia_id = f where user_id = u and familia_id is null;
    update public.fin_planos   set familia_id = f where user_id = u and familia_id is null;
    update public.fin_cartoes  set familia_id = f where user_id = u and familia_id is null;
  end loop;
end $$;

alter table public.fin_despesas alter column familia_id set not null;
alter table public.fin_rendas   alter column familia_id set not null;
alter table public.fin_planos   alter column familia_id set not null;
alter table public.fin_cartoes  alter column familia_id set not null;

create index if not exists fin_despesas_familia_idx on public.fin_despesas(familia_id);
create index if not exists fin_rendas_familia_idx   on public.fin_rendas(familia_id);
create index if not exists fin_planos_familia_idx   on public.fin_planos(familia_id);
create index if not exists fin_cartoes_familia_idx  on public.fin_cartoes(familia_id);

-- ─── Funções ─────────────────────────────────────────────────────────

create or replace function public.fin_is_membro(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from fin_membros where familia_id = f and user_id = auth.uid())
$$;

-- Família do usuário logado; cria uma na primeira vez
create or replace function public.fin_minha_familia() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  f uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  select familia_id into f from fin_membros where user_id = auth.uid();
  if f is null then
    insert into fin_familias default values returning id into f;
    insert into fin_membros (familia_id, user_id, papel) values (f, auth.uid(), 'titular');
  end if;
  return f;
end $$;

create or replace function public.fin_criar_convite() returns text
language plpgsql security definer set search_path = public as $$
declare
  f uuid := fin_minha_familia();
  c text := upper(substr(md5(gen_random_uuid()::text), 1, 6));
begin
  insert into fin_convites (codigo, familia_id, criado_por) values (c, f, auth.uid());
  return c;
end $$;

create or replace function public.fin_entrar_familia(p_codigo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  conv fin_convites;
  atual uuid;
begin
  select * into conv from fin_convites where codigo = upper(trim(p_codigo));
  if conv.codigo is null or conv.usado_por is not null or conv.expira_em < now() then
    raise exception 'Convite inválido ou expirado';
  end if;

  select familia_id into atual from fin_membros where user_id = auth.uid();
  if atual = conv.familia_id then
    return atual;
  end if;

  if atual is not null then
    -- Não descarta dados de ninguém: só troca de família quem ainda não lançou nada
    if exists (select 1 from fin_despesas where familia_id = atual)
      or exists (select 1 from fin_rendas where familia_id = atual)
      or exists (select 1 from fin_planos where familia_id = atual)
      or exists (select 1 from fin_cartoes where familia_id = atual)
      or exists (select 1 from fin_lancamentos where familia_id = atual)
      or exists (select 1 from fin_contas where familia_id = atual)
      or exists (select 1 from fin_dividas where familia_id = atual)
    then
      raise exception 'Você já tem dados financeiros próprios. Exclua-os antes de entrar em outra família.';
    end if;
    delete from fin_membros where user_id = auth.uid();
    delete from fin_familias where id = atual and not exists (select 1 from fin_membros where familia_id = atual);
  end if;

  insert into fin_membros (familia_id, user_id) values (conv.familia_id, auth.uid());
  update fin_convites set usado_por = auth.uid() where codigo = conv.codigo;
  return conv.familia_id;
end $$;

-- Nomes dos membros (profiles só deixa cada um ver o próprio)
create or replace function public.fin_membros_familia()
returns table (user_id uuid, nome text, email text, avatar_url text, papel text)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.name, p.email, p.avatar_url, m.papel
  from fin_membros m
  left join profiles p on p.id = m.user_id
  where m.familia_id = (select familia_id from fin_membros where user_id = auth.uid())
  order by m.created_at
$$;

-- ─── RLS: tudo visível e editável pelos membros da família ───────────

alter table public.fin_familias    enable row level security;
alter table public.fin_membros     enable row level security;
alter table public.fin_convites    enable row level security;
alter table public.fin_lancamentos enable row level security;
alter table public.fin_contas      enable row level security;
alter table public.fin_dividas     enable row level security;
alter table public.fin_fechamentos enable row level security;

create policy "fin_familias_membro_select" on public.fin_familias
  for select using (fin_is_membro(id));
create policy "fin_familias_membro_update" on public.fin_familias
  for update using (fin_is_membro(id)) with check (fin_is_membro(id));

create policy "fin_membros_select" on public.fin_membros
  for select using (fin_is_membro(familia_id));

create policy "fin_convites_select" on public.fin_convites
  for select using (fin_is_membro(familia_id));

drop policy if exists "fin_despesas_own" on public.fin_despesas;
drop policy if exists "fin_rendas_own"   on public.fin_rendas;
drop policy if exists "fin_planos_own"   on public.fin_planos;
drop policy if exists "fin_cartoes_own"  on public.fin_cartoes;

create policy "fin_despesas_familia"    on public.fin_despesas    for all using (fin_is_membro(familia_id)) with check (fin_is_membro(familia_id));
create policy "fin_rendas_familia"      on public.fin_rendas      for all using (fin_is_membro(familia_id)) with check (fin_is_membro(familia_id));
create policy "fin_planos_familia"      on public.fin_planos      for all using (fin_is_membro(familia_id)) with check (fin_is_membro(familia_id));
create policy "fin_cartoes_familia"     on public.fin_cartoes     for all using (fin_is_membro(familia_id)) with check (fin_is_membro(familia_id));
create policy "fin_lancamentos_familia" on public.fin_lancamentos for all using (fin_is_membro(familia_id)) with check (fin_is_membro(familia_id));
create policy "fin_contas_familia"      on public.fin_contas      for all using (fin_is_membro(familia_id)) with check (fin_is_membro(familia_id));
create policy "fin_dividas_familia"     on public.fin_dividas     for all using (fin_is_membro(familia_id)) with check (fin_is_membro(familia_id));
create policy "fin_fechamentos_familia" on public.fin_fechamentos for all using (fin_is_membro(familia_id)) with check (fin_is_membro(familia_id));
