-- Paideia Ekos — orçamento familiar: gastos e rendas recorrentes

create table if not exists public.fin_despesas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  descricao text not null,
  categoria text not null default 'outros',
  valor numeric(12,2) not null check (valor >= 0),
  -- mensal: todo mês | anual: uma vez por ano (IPVA, IPTU, seguro...) | parcelada: some quando acabam as parcelas
  frequencia text not null default 'mensal' check (frequencia in ('mensal', 'anual', 'parcelada')),
  parcelas_restantes int check (parcelas_restantes is null or parcelas_restantes >= 0),
  dia_vencimento int check (dia_vencimento is null or dia_vencimento between 1 and 31),
  essencial boolean not null default true,
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_rendas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  descricao text not null,
  tipo text not null default 'salario'
    check (tipo in ('salario', 'ferias', 'decimo_terceiro', 'beneficio', 'extra', 'investimento', 'aluguel', 'outro')),
  valor numeric(12,2) not null check (valor >= 0), -- valor líquido que de fato entra
  frequencia text not null default 'mensal' check (frequencia in ('mensal', 'anual', 'eventual')),
  mes_recebimento int check (mes_recebimento is null or mes_recebimento between 1 and 12),
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_despesas_user_idx on public.fin_despesas(user_id);
create index if not exists fin_rendas_user_idx on public.fin_rendas(user_id);

alter table public.fin_despesas enable row level security;
alter table public.fin_rendas enable row level security;

-- Dados financeiros são estritamente privados: cada usuário só vê e altera os próprios
create policy "fin_despesas_own" on public.fin_despesas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "fin_rendas_own" on public.fin_rendas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
