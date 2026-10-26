-- Paideia Ekos — reclassifica gastos já lançados nas categorias novas, pelo nome
-- (Supermercado, Combustível, Fitness, Viagens). Vale para lançamentos e para o orçamento.
--
-- PASSO 1: selecione e rode só a PRÉVIA. Confira a lista.
-- PASSO 2: se estiver certo, selecione e rode o bloco APLICAR.
-- Para ajustar, edite a lista de regras (igual nos dois blocos). '%' = qualquer coisa.
-- Acentos e maiúsculas são ignorados na comparação.

-- ═══ PRÉVIA ═══════════════════════════════════════════════════════════
with regras(categoria, padrao) as (
  values
    ('combustivel', '%posto%'), ('combustivel', '%combust%'), ('combustivel', '%shell%'), ('combustivel', '%ipiranga%'),
    ('combustivel', '%petrobras%'), ('combustivel', '%br mania%'), ('combustivel', '%gasolina%'),
    ('fitness', '%wellhub%'), ('fitness', '%gympass%'), ('fitness', '%crossfit%'), ('fitness', '%cross fit%'),
    ('fitness', '%smart fit%'), ('fitness', '%smartfit%'), ('fitness', '%academia%'),
    ('viagens', '%latam%'), ('viagens', '%gol linhas%'), ('viagens', '%azul linhas%'), ('viagens', '%airbnb%'),
    ('viagens', '%booking%'), ('viagens', '%hotel%'), ('viagens', '%pousada%'), ('viagens', '%decolar%'),
    ('viagens', '%123milhas%'), ('viagens', '%localiza%'), ('viagens', '%movida%'),
    ('supermercado', '%supermerc%'), ('supermercado', '%hipermerc%'), ('supermercado', '%atacad%'),
    ('supermercado', '%assai%'), ('supermercado', '%carrefour%'), ('supermercado', '%pao de acucar%'),
    ('supermercado', '%mercadinho%'), ('supermercado', '%padaria%'), ('supermercado', '%acougue%'),
    ('supermercado', '%hortifruti%')
),
itens as (
  select 'lancamento' as tabela, id, descricao, categoria, valor from public.fin_lancamentos
  union all
  select 'orcamento', id, descricao, categoria, valor from public.fin_despesas
)
select distinct on (i.tabela, i.id)
  i.tabela, i.descricao, i.categoria as categoria_atual, r.categoria as nova_categoria, i.valor
from itens i
join regras r on translate(lower(i.descricao), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like r.padrao
where i.categoria <> r.categoria
order by i.tabela, i.id;


-- ═══ APLICAR ══════════════════════════════════════════════════════════
with regras(categoria, padrao) as (
  values
    ('combustivel', '%posto%'), ('combustivel', '%combust%'), ('combustivel', '%shell%'), ('combustivel', '%ipiranga%'),
    ('combustivel', '%petrobras%'), ('combustivel', '%br mania%'), ('combustivel', '%gasolina%'),
    ('fitness', '%wellhub%'), ('fitness', '%gympass%'), ('fitness', '%crossfit%'), ('fitness', '%cross fit%'),
    ('fitness', '%smart fit%'), ('fitness', '%smartfit%'), ('fitness', '%academia%'),
    ('viagens', '%latam%'), ('viagens', '%gol linhas%'), ('viagens', '%azul linhas%'), ('viagens', '%airbnb%'),
    ('viagens', '%booking%'), ('viagens', '%hotel%'), ('viagens', '%pousada%'), ('viagens', '%decolar%'),
    ('viagens', '%123milhas%'), ('viagens', '%localiza%'), ('viagens', '%movida%'),
    ('supermercado', '%supermerc%'), ('supermercado', '%hipermerc%'), ('supermercado', '%atacad%'),
    ('supermercado', '%assai%'), ('supermercado', '%carrefour%'), ('supermercado', '%pao de acucar%'),
    ('supermercado', '%mercadinho%'), ('supermercado', '%padaria%'), ('supermercado', '%acougue%'),
    ('supermercado', '%hortifruti%')
),
lanc as (
  update public.fin_lancamentos l
  set categoria = r.categoria
  from regras r
  where translate(lower(l.descricao), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like r.padrao
    and l.categoria <> r.categoria
  returning l.id
),
orc as (
  update public.fin_despesas d
  set categoria = r.categoria, updated_at = now()
  from regras r
  where translate(lower(d.descricao), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like r.padrao
    and d.categoria <> r.categoria
  returning d.id
)
select (select count(*) from lanc) as lancamentos_reclassificados,
       (select count(*) from orc) as itens_do_orcamento_reclassificados;
