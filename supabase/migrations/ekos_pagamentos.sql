-- Paideia Ekos — pago ou pendente, data de pagamento e previsão de saídas
--
-- Fora do cartão (Pix, débito, boleto): cada lançamento tem o próprio vencimento e status.
--   data       = quando comprou
--   vencimento = quando o dinheiro sai (null = na própria data da compra)
--   pago       = já saiu da conta
-- No cartão, quem se paga é a fatura: o status fica em fin_faturas (uma linha = fatura paga).

alter table public.fin_lancamentos
  add column if not exists vencimento date,
  add column if not exists pago boolean not null default true;

create table if not exists public.fin_faturas (
  familia_id  uuid not null references public.fin_familias(id) on delete cascade,
  cartao_id   uuid not null references public.fin_cartoes(id) on delete cascade,
  competencia date not null, -- mês da fatura (o mesmo de fin_lancamentos.competencia)
  pago_em     timestamptz not null default now(),
  primary key (cartao_id, competencia)
);

alter table public.fin_faturas enable row level security;

drop policy if exists "fin_faturas_familia" on public.fin_faturas;
create policy "fin_faturas_familia" on public.fin_faturas
  for all using (fin_is_membro(familia_id)) with check (fin_is_membro(familia_id));

-- Tabelas novas não ficam liberadas para a API sem GRANT explícito
grant select, insert, update, delete on public.fin_faturas to authenticated;
grant all on public.fin_faturas to service_role;

-- Faturas antigas: tudo o que venceu antes deste mês conta como pago.
-- A fatura vence no próprio mês, ou no seguinte quando o vencimento cai antes do fechamento.
insert into public.fin_faturas (familia_id, cartao_id, competencia)
select distinct l.familia_id, l.cartao_id, l.competencia
from public.fin_lancamentos l
join public.fin_cartoes c on c.id = l.cartao_id
where (
  l.competencia
  + case when c.dia_fechamento is not null and c.dia_vencimento <= c.dia_fechamento
         then interval '1 month' else interval '0' end
) < date_trunc('month', current_date)
on conflict do nothing;
