-- Paideia Ekos — financiamento da casa (SAC) como dívida de verdade
--
-- Dados do banco (out/2026):
--   saldo devedor R$ 338.636,11 · prazo restante 412 de 420 meses · valor financiado R$ 340.000,00
--   juros efetivos com relacionamento 11,1899% a.a. = 0,8878% a.m. (a coluna guarda 3 casas: 0,888)
--   parcela atual R$ 4.101,51 = ~R$ 3.006,51 de juros + R$ 821,93 de amortização + ~R$ 273 de seguros/taxas
--
-- SAC: a amortização é fixa (saldo ÷ prazo) e a parcela cai a cada mês. O simulador de quitação passa a saber disso.

alter table public.fin_dividas
  add column if not exists amortizacao text not null default 'price' check (amortizacao in ('price', 'sac')),
  add column if not exists prazo_meses int check (prazo_meses is null or prazo_meses > 0);

do $$
declare
  v_familia uuid;
  v_user uuid;
  v_n int;
begin
  select familia_id, user_id into v_familia, v_user from public.fin_membros where papel = 'titular' limit 1;

  -- A dívida: atualiza se já existir (pelo aviso de Patrimônio), senão cria
  update public.fin_dividas set
    tipo = 'financiamento', saldo = 338636.11, juros_mensal = 0.888, parcela = 4101.51,
    amortizacao = 'sac', prazo_meses = 412, updated_at = now()
  where familia_id = v_familia and nome = 'Financiamento da casa';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    insert into public.fin_dividas (familia_id, user_id, nome, tipo, saldo, juros_mensal, parcela, amortizacao, prazo_meses)
    values (v_familia, v_user, 'Financiamento da casa', 'financiamento', 338636.11, 0.888, 4101.51, 'sac', 412);
  end if;

  -- No Orçamento: parcelado, 412 de 420 a partir de novembro/2026 (a de novembro é a 9ª)
  update public.fin_despesas set
    frequencia = 'parcelada', parcelas_total = 420, parcelas_restantes = 412, parcelas_ref = date '2026-11-01',
    updated_at = now()
  where familia_id = v_familia and cartao_id is null and descricao = 'Financiamento da casa';
end $$;

-- Conferência
select nome, saldo, juros_mensal, parcela, amortizacao, prazo_meses from public.fin_dividas where nome = 'Financiamento da casa';
select descricao, valor, frequencia, parcelas_total, parcelas_restantes, parcelas_ref from public.fin_despesas where descricao = 'Financiamento da casa';
