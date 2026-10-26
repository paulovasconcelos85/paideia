-- Paideia Ekos — correção única: devolve à fatura certa os lançamentos movidos ao editar
-- Um bug recalculava o mês do lançamento pela data da compra original ao salvar uma edição,
-- jogando parcelas importadas para meses passados. Cada importação grava todas as linhas no
-- mesmo instante (created_at igual): o mês certo é o da maioria das linhas daquela importação.

update public.fin_lancamentos l
set competencia = lote.competencia
from (
  select familia_id, created_at, mode() within group (order by competencia) as competencia
  from public.fin_lancamentos
  where origem = 'fatura'
  group by familia_id, created_at
  having count(*) > 1
) lote
where l.origem = 'fatura'
  and l.familia_id = lote.familia_id
  and l.created_at = lote.created_at
  and l.competencia <> lote.competencia
returning l.descricao, l.competencia as voltou_para;
