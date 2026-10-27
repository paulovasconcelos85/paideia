-- Paideia Ekos — entradas: o que de fato caiu na conta (salário, 13º, abono, férias, saldo)
--
-- fin_rendas continua sendo a previsão (o salário de todo mês); fin_receitas guarda o que entrou.
-- O salário cai no dia 26 e paga as contas do MÊS SEGUINTE: o de 26/10 banca novembro.
-- Por isso cada entrada tem a data em que caiu e a competência (o mês que ela paga).
-- "Saldo na conta" (sobra do mês anterior) fica guardado, mas não conta como renda nem para o dízimo.
--
-- Histórico: planilha "Contas Accounts Consolidada - Créditos", jan./2020 a mar./2026.
-- Pode rodar de novo: não duplica.

create table if not exists public.fin_receitas (
  id          uuid primary key default gen_random_uuid(),
  familia_id  uuid not null references public.fin_familias(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  data        date not null,           -- quando caiu na conta
  competencia date not null,           -- mês que ela paga (YYYY-MM-01)
  tipo        text not null default 'salario'
              check (tipo in ('salario', 'decimo_terceiro', 'abono', 'ferias', 'saldo', 'extra')),
  descricao   text,
  valor       numeric(12, 2) not null,
  created_at  timestamptz not null default now()
);
create index if not exists fin_receitas_comp_idx on public.fin_receitas(familia_id, competencia);

alter table public.fin_receitas enable row level security;
drop policy if exists "fin_receitas_familia" on public.fin_receitas;
create policy "fin_receitas_familia" on public.fin_receitas
  for all using (fin_is_membro(familia_id)) with check (fin_is_membro(familia_id));

-- Tabelas novas não ficam liberadas para a API sem GRANT explícito
grant select, insert, update, delete on public.fin_receitas to authenticated;
grant all on public.fin_receitas to service_role;

-- Dia em que a renda cai (o salário: dia 26)
alter table public.fin_rendas
  add column if not exists dia_recebimento int check (dia_recebimento is null or dia_recebimento between 1 and 31);
update public.fin_rendas set dia_recebimento = 26 where tipo = 'salario' and frequencia = 'mensal' and dia_recebimento is null;

-- Histórico
create temporary table credito (data date, competencia date, tipo text, valor numeric(12, 2));
insert into credito (data, competencia, tipo, valor) values
(date '2026-03-26', date '2026-04-01', 'salario', 18580.13),
(date '2026-02-26', date '2026-03-01', 'salario', 22000.00),
(date '2026-01-26', date '2026-02-01', 'salario', 17753.15),
(date '2025-12-26', date '2026-01-01', 'salario', 17753.15),
(date '2025-12-26', date '2026-01-01', 'decimo_terceiro', 4610.92),
(date '2025-12-26', date '2026-01-01', 'saldo', 6733.11),
(date '2025-11-26', date '2025-12-01', 'salario', 17753.15),
(date '2025-11-26', date '2025-12-01', 'saldo', 670.00),
(date '2025-10-26', date '2025-11-01', 'salario', 17753.15),
(date '2025-10-26', date '2025-11-01', 'saldo', 4920.62),
(date '2025-09-26', date '2025-10-01', 'salario', 20203.13),
(date '2025-09-26', date '2025-10-01', 'saldo', 500.00),
(date '2025-08-26', date '2025-09-01', 'salario', 17753.15),
(date '2025-08-26', date '2025-09-01', 'saldo', 13968.14),
(date '2025-07-26', date '2025-08-01', 'salario', 17753.15),
(date '2025-07-26', date '2025-08-01', 'abono', 2900.00),
(date '2025-06-26', date '2025-07-01', 'salario', 17753.15),
(date '2025-06-26', date '2025-07-01', 'decimo_terceiro', 8961.00),
(date '2025-06-26', date '2025-07-01', 'saldo', 275.01),
(date '2025-05-26', date '2025-06-01', 'salario', 20599.16),
(date '2025-05-26', date '2025-06-01', 'saldo', 52.86),
(date '2025-04-26', date '2025-05-01', 'salario', 17458.08),
(date '2025-04-26', date '2025-05-01', 'saldo', 480.09),
(date '2025-03-26', date '2025-04-01', 'salario', 16753.91),
(date '2025-03-26', date '2025-04-01', 'saldo', 77.00),
(date '2025-02-26', date '2025-03-01', 'salario', 23820.55),
(date '2025-02-26', date '2025-03-01', 'saldo', 197.06),
(date '2025-01-26', date '2025-02-01', 'salario', 14724.91),
(date '2025-01-26', date '2025-02-01', 'saldo', 1128.99),
(date '2024-12-26', date '2025-01-01', 'salario', 19841.38),
(date '2024-12-26', date '2025-01-01', 'decimo_terceiro', 4433.79),
(date '2024-12-26', date '2025-01-01', 'abono', 24264.20),
(date '2024-12-26', date '2025-01-01', 'saldo', 3190.20),
(date '2024-11-26', date '2024-12-01', 'salario', 17496.23),
(date '2024-11-26', date '2024-12-01', 'abono', 15771.73),
(date '2024-11-26', date '2024-12-01', 'saldo', 1967.00),
(date '2024-10-26', date '2024-11-01', 'salario', 19841.38),
(date '2024-10-26', date '2024-11-01', 'saldo', 1408.79),
(date '2024-09-26', date '2024-10-01', 'salario', 17496.23),
(date '2024-09-26', date '2024-10-01', 'saldo', 9919.21),
(date '2024-08-26', date '2024-09-01', 'salario', 19841.38),
(date '2024-08-26', date '2024-09-01', 'ferias', 11868.42),
(date '2024-07-26', date '2024-08-01', 'salario', 17496.23),
(date '2024-07-26', date '2024-08-01', 'saldo', 6518.00),
(date '2024-06-26', date '2024-07-01', 'salario', 17496.23),
(date '2024-06-26', date '2024-07-01', 'decimo_terceiro', 9097.43),
(date '2024-06-26', date '2024-07-01', 'saldo', 6621.33),
(date '2024-05-26', date '2024-06-01', 'salario', 20959.36),
(date '2024-05-26', date '2024-06-01', 'saldo', 2202.92),
(date '2024-04-26', date '2024-05-01', 'salario', 18832.38),
(date '2024-04-26', date '2024-05-01', 'saldo', 959.06),
(date '2024-03-26', date '2024-04-01', 'salario', 16598.96),
(date '2024-03-26', date '2024-04-01', 'saldo', 3168.57),
(date '2024-02-26', date '2024-03-01', 'salario', 18781.41),
(date '2024-02-26', date '2024-03-01', 'saldo', 1937.40),
(date '2024-01-26', date '2024-02-01', 'salario', 16537.95),
(date '2024-01-26', date '2024-02-01', 'saldo', 6094.22),
(date '2023-12-26', date '2024-01-01', 'salario', 18212.27),
(date '2023-12-26', date '2024-01-01', 'decimo_terceiro', 4205.49),
(date '2023-12-26', date '2024-01-01', 'abono', 15000.00),
(date '2023-12-26', date '2024-01-01', 'saldo', 707.16),
(date '2023-11-26', date '2023-12-01', 'salario', 16537.95),
(date '2023-11-26', date '2023-12-01', 'saldo', 1362.97),
(date '2023-10-26', date '2023-11-01', 'salario', 18770.37),
(date '2023-10-26', date '2023-11-01', 'saldo', 1352.89),
(date '2023-09-26', date '2023-10-01', 'salario', 16537.95),
(date '2023-09-26', date '2023-10-01', 'saldo', 2421.19),
(date '2023-08-26', date '2023-09-01', 'salario', 18770.37),
(date '2023-08-26', date '2023-09-01', 'saldo', 2221.72),
(date '2023-07-26', date '2023-08-01', 'salario', 20898.35),
(date '2023-07-26', date '2023-08-01', 'saldo', 1200.00),
(date '2023-06-26', date '2023-07-01', 'salario', 18770.37),
(date '2023-06-26', date '2023-07-01', 'decimo_terceiro', 8728.72),
(date '2023-06-26', date '2023-07-01', 'saldo', 1478.40),
(date '2023-05-26', date '2023-06-01', 'salario', 16418.05),
(date '2023-05-26', date '2023-06-01', 'saldo', 6057.20),
(date '2023-04-26', date '2023-05-01', 'salario', 18604.89),
(date '2023-04-26', date '2023-05-01', 'saldo', 4160.58),
(date '2023-03-26', date '2023-04-01', 'salario', 16372.47),
(date '2023-03-26', date '2023-04-01', 'saldo', 1773.03),
(date '2023-02-26', date '2023-03-01', 'salario', 17996.64),
(date '2023-02-26', date '2023-03-01', 'saldo', 1569.06),
(date '2023-01-26', date '2023-02-01', 'salario', 12730.11),
(date '2023-01-26', date '2023-02-01', 'saldo', 2300.12),
(date '2022-12-26', date '2023-01-01', 'salario', 13272.39),
(date '2022-12-26', date '2023-01-01', 'abono', 20000.00),
(date '2022-11-26', date '2022-12-01', 'salario', 11648.94),
(date '2022-11-26', date '2022-12-01', 'saldo', 2123.00),
(date '2022-10-26', date '2022-11-01', 'salario', 13791.91),
(date '2022-10-26', date '2022-11-01', 'saldo', 1832.72),
(date '2022-09-26', date '2022-10-01', 'salario', 11170.88),
(date '2022-09-26', date '2022-10-01', 'saldo', 771.77),
(date '2022-08-26', date '2022-09-01', 'salario', 11170.88),
(date '2022-08-26', date '2022-09-01', 'saldo', 1900.00),
(date '2022-07-26', date '2022-08-01', 'salario', 12220.26),
(date '2022-07-26', date '2022-08-01', 'saldo', 1082.00),
(date '2022-06-26', date '2022-07-01', 'salario', 13354.72),
(date '2022-06-26', date '2022-07-01', 'decimo_terceiro', 7116.96),
(date '2022-06-26', date '2022-07-01', 'saldo', 321.02),
(date '2022-05-26', date '2022-06-01', 'salario', 10688.86),
(date '2022-05-26', date '2022-06-01', 'saldo', 1962.74),
(date '2022-04-26', date '2022-05-01', 'salario', 9633.00),
(date '2022-04-26', date '2022-05-01', 'saldo', 2000.00),
(date '2022-03-26', date '2022-04-01', 'salario', 17304.57),
(date '2022-03-26', date '2022-04-01', 'saldo', 1000.00),
(date '2022-02-26', date '2022-03-01', 'salario', 17057.93),
(date '2022-02-26', date '2022-03-01', 'saldo', 1077.24),
(date '2022-01-26', date '2022-02-01', 'salario', 15635.82),
(date '2021-12-26', date '2022-01-01', 'salario', 15404.41),
(date '2021-12-26', date '2022-01-01', 'abono', 5000.00),
(date '2021-11-26', date '2021-12-01', 'salario', 9952.90),
(date '2021-11-26', date '2021-12-01', 'saldo', 580.98),
(date '2021-10-26', date '2021-11-01', 'salario', 9919.97),
(date '2021-10-26', date '2021-11-01', 'saldo', 467.87),
(date '2021-09-26', date '2021-10-01', 'salario', 9919.97),
(date '2021-08-26', date '2021-09-01', 'salario', 9919.97),
(date '2021-07-26', date '2021-08-01', 'salario', 9919.97),
(date '2021-07-26', date '2021-08-01', 'saldo', 961.98),
(date '2021-06-26', date '2021-07-01', 'salario', 10867.27),
(date '2021-06-26', date '2021-07-01', 'saldo', 752.87),
(date '2021-05-26', date '2021-06-01', 'salario', 12769.57),
(date '2021-05-26', date '2021-06-01', 'saldo', 475.27),
(date '2021-04-26', date '2021-05-01', 'salario', 13122.27),
(date '2021-04-26', date '2021-05-01', 'saldo', 737.71),
(date '2021-03-26', date '2021-04-01', 'salario', 12626.51),
(date '2021-02-26', date '2021-03-01', 'salario', 12309.40),
(date '2021-02-26', date '2021-03-01', 'saldo', 377.64),
(date '2021-01-26', date '2021-02-01', 'salario', 14588.04),
(date '2021-01-26', date '2021-02-01', 'saldo', 2166.31),
(date '2020-12-26', date '2021-01-01', 'salario', 12648.17),
(date '2020-12-26', date '2021-01-01', 'decimo_terceiro', 2562.90),
(date '2020-12-26', date '2021-01-01', 'abono', 3500.00),
(date '2020-12-26', date '2021-01-01', 'saldo', 2474.10),
(date '2020-11-26', date '2020-12-01', 'salario', 9876.51),
(date '2020-11-26', date '2020-12-01', 'saldo', 1279.00),
(date '2020-10-26', date '2020-11-01', 'salario', 9876.51),
(date '2020-10-26', date '2020-11-01', 'saldo', 400.00),
(date '2020-09-26', date '2020-10-01', 'salario', 9876.00),
(date '2020-09-26', date '2020-10-01', 'saldo', 900.00),
(date '2020-08-26', date '2020-09-01', 'salario', 11326.51),
(date '2020-08-26', date '2020-09-01', 'saldo', 988.69),
(date '2020-07-26', date '2020-08-01', 'salario', 13900.00),
(date '2020-07-26', date '2020-08-01', 'saldo', 800.00),
(date '2020-06-26', date '2020-07-01', 'salario', 12168.25),
(date '2020-06-26', date '2020-07-01', 'decimo_terceiro', 5542.37),
(date '2020-06-26', date '2020-07-01', 'saldo', 977.15),
(date '2020-05-26', date '2020-06-01', 'salario', 11449.14),
(date '2020-05-26', date '2020-06-01', 'saldo', 1628.15),
(date '2020-04-26', date '2020-05-01', 'salario', 11140.72),
(date '2020-04-26', date '2020-05-01', 'saldo', 3333.52),
(date '2020-03-26', date '2020-04-01', 'salario', 10545.00),
(date '2020-03-26', date '2020-04-01', 'saldo', 700.00),
(date '2020-02-26', date '2020-03-01', 'salario', 10839.84),
(date '2020-02-26', date '2020-03-01', 'saldo', 600.00),
(date '2020-01-26', date '2020-02-01', 'salario', 10964.49),
(date '2020-01-26', date '2020-02-01', 'saldo', -154.06)
;

insert into public.fin_receitas (familia_id, user_id, data, competencia, tipo, valor)
select m.familia_id, m.user_id, c.data, c.competencia, c.tipo, c.valor
from credito c
cross join (select familia_id, user_id from public.fin_membros where papel = 'titular' limit 1) m
where not exists (
  select 1 from public.fin_receitas r
  where r.familia_id = m.familia_id and r.data = c.data and r.tipo = c.tipo and r.valor = c.valor
);

-- Conferência: renda por ano (sem o saldo na conta)
select extract(year from competencia)::int as ano, count(*) as entradas, sum(valor) as total
from public.fin_receitas
where tipo <> 'saldo'
group by 1 order by 1;
