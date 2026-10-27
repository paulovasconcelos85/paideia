-- Paideia Ekos — aportes dos planos viram contas do mês
--
-- Cada plano ativo com aporte mensal aparece nas Contas do mês ("Guardar para ..."), como uma conta:
-- marcar como pago registra o aporte, e o "já guardado" do plano sobe sozinho.
-- O aporte vence logo depois do salário (dia 27 do mês anterior, por padrão): primeiro guardar, depois gastar.
--
-- Plano em dólar pode acompanhar o que já tem pelo dólar guardado em Patrimônio, em vez dos aportes.

create table if not exists public.fin_aportes (
  id          uuid primary key default gen_random_uuid(),
  familia_id  uuid not null references public.fin_familias(id) on delete cascade,
  plano_id    uuid not null references public.fin_planos(id) on delete cascade,
  competencia date not null,              -- mês das contas em que o aporte entra (YYYY-MM-01)
  valor       numeric(12, 2) not null,    -- em reais
  pago        boolean not null default true,
  data        date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (plano_id, competencia)
);
create index if not exists fin_aportes_comp_idx on public.fin_aportes(familia_id, competencia);

alter table public.fin_aportes enable row level security;
drop policy if exists "fin_aportes_familia" on public.fin_aportes;
create policy "fin_aportes_familia" on public.fin_aportes
  for all using (fin_is_membro(familia_id)) with check (fin_is_membro(familia_id));

-- Tabelas novas não ficam liberadas para a API sem GRANT explícito
grant select, insert, update, delete on public.fin_aportes to authenticated;
grant all on public.fin_aportes to service_role;

alter table public.fin_planos
  add column if not exists dia_aporte int not null default 27 check (dia_aporte between 1 and 31),
  -- 'aportes': base informada + aportes pagos · 'dolar': o dólar guardado em Patrimônio
  add column if not exists guardado_por text not null default 'aportes' check (guardado_por in ('aportes', 'dolar'));

-- Situação simplificada: "ideia" vira "pausado" (ativo ou pausado; concluído continua existindo)
update public.fin_planos set status = 'pausado' where status = 'ideia';
