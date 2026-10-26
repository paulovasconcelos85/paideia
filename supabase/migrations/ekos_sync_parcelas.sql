-- Paideia Ekos — correção única: alinha os lançamentos ao orçamento
-- Lançamentos importados da fatura guardavam a parcela lida pela IA (às vezes errada, ex.: "1/12").
-- O orçamento (fin_despesas) é a fonte da verdade: copia dele número da parcela, descrição,
-- categoria e essencial para cada lançamento ligado (despesa_id). Pode rodar mais de uma vez.

update public.fin_lancamentos l
set
  descricao = d.descricao,
  categoria = d.categoria,
  essencial = d.essencial,
  parcelas_total = case when d.frequencia = 'parcelada' then d.parcelas_total else l.parcelas_total end,
  -- parcela do mês = total − (restantes no mês de referência − meses passados desde então) + 1
  parcela_atual = case
    when d.frequencia = 'parcelada' and d.parcelas_total is not null and d.parcelas_restantes is not null and d.parcelas_ref is not null
    then d.parcelas_total - d.parcelas_restantes + 1
         + ((extract(year from l.competencia) - extract(year from d.parcelas_ref)) * 12
            + (extract(month from l.competencia) - extract(month from d.parcelas_ref)))::int
    else l.parcela_atual
  end
from public.fin_despesas d
where l.despesa_id = d.id;
