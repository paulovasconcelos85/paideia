-- Paideia Ekos — cartões de crédito e parcelas que se atualizam com o tempo

create table if not exists public.fin_cartoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  dia_vencimento int check (dia_vencimento is null or dia_vencimento between 1 and 31),
  dia_fechamento int check (dia_fechamento is null or dia_fechamento between 1 and 31),
  limite numeric(12,2) check (limite is null or limite >= 0),
  created_at timestamptz not null default now()
);

create index if not exists fin_cartoes_user_idx on public.fin_cartoes(user_id);

alter table public.fin_cartoes enable row level security;

create policy "fin_cartoes_own" on public.fin_cartoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Gasto pago no cartão (null = boleto, débito, Pix, dinheiro)
alter table public.fin_despesas
  add column if not exists cartao_id uuid references public.fin_cartoes(id) on delete set null,
  -- Parcelas: parcelas_restantes vale para o mês parcelas_ref (incluindo a parcela desse mês);
  -- a cada mês que passa, uma parcela a menos
  add column if not exists parcelas_total int check (parcelas_total is null or parcelas_total > 0),
  add column if not exists parcelas_ref date;

create index if not exists fin_despesas_cartao_idx on public.fin_despesas(cartao_id);

-- Parcelados já cadastrados passam a contar a partir do mês da última edição
update public.fin_despesas
  set parcelas_ref = date_trunc('month', updated_at)::date
  where frequencia = 'parcelada' and parcelas_ref is null;
