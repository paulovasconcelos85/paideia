-- Paideia Ekos — dízimo: 10% da renda de cada mês, devolvido ao Senhor
-- Não é gasto: fica fora do "gasto no mês" e dos limites. Mês não devolvido continua em aberto.
-- Uma linha = dízimo daquele mês devolvido (valor = quanto foi devolvido).

create table if not exists public.fin_dizimos (
  familia_id   uuid not null references public.fin_familias(id) on delete cascade,
  competencia  date not null, -- mês da renda (YYYY-MM-01)
  valor        numeric(12, 2) not null,
  devolvido_em date not null default current_date,
  primary key (familia_id, competencia)
);

-- A conta do dízimo começa no mês em que foi ativada (meses antes disso não ficam em aberto)
alter table public.fin_familias
  add column if not exists dizimo_desde date not null default date_trunc('month', current_date)::date;

alter table public.fin_dizimos enable row level security;

drop policy if exists "fin_dizimos_familia" on public.fin_dizimos;
create policy "fin_dizimos_familia" on public.fin_dizimos
  for all using (fin_is_membro(familia_id)) with check (fin_is_membro(familia_id));

-- Tabelas novas não ficam liberadas para a API sem GRANT explícito
grant select, insert, update, delete on public.fin_dizimos to authenticated;
grant all on public.fin_dizimos to service_role;
