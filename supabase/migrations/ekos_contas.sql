-- Paideia Ekos — contas com data de início e cadastro das minhas contas (novembro/2026)
--
-- 1) Conta fixa passa a ter "inicio": o primeiro vencimento. Antes disso ela não aparece
--    (antes, "vence dia 2" cadastrado em 27/10 virava "vencida em 02/10").
-- 2) Cadastra as contas fora do cartão. Se já existir uma parecida, atualiza em vez de duplicar;
--    duplicadas antigas ficam desativadas (não são apagadas).
-- 3) Valores e datas que fogem do padrão (energia de dezembro, IPTU, FIAP) entram como
--    lançamentos "a pagar" já com valor e vencimento exatos.
-- Pode rodar mais de uma vez: refaz só o que estiver pendente (o que já foi pago fica intacto).

alter table public.fin_despesas add column if not exists inicio date;

-- Conta fixa: acha uma parecida (busca), atualiza ou cria; limpa pendências futuras dela
create or replace function pg_temp.conta(
  p_busca text[], p_excluir text[], p_descricao text, p_categoria text, p_valor numeric,
  p_frequencia text, p_total int, p_restantes int, p_dia int, p_inicio date, p_ativo boolean
) returns uuid language plpgsql as $$
declare
  v_familia uuid;
  v_user uuid;
  v_id uuid;
begin
  select familia_id, user_id into v_familia, v_user from public.fin_membros where papel = 'titular' limit 1;

  select id into v_id from public.fin_despesas
  where familia_id = v_familia and cartao_id is null
    and descricao ilike any (p_busca) and not (descricao ilike any (p_excluir))
  order by ativo desc, created_at desc
  limit 1;

  if v_id is null then
    insert into public.fin_despesas (familia_id, user_id, descricao, categoria, valor, frequencia, essencial)
    values (v_familia, v_user, p_descricao, p_categoria, p_valor, p_frequencia, true)
    returning id into v_id;
  end if;

  update public.fin_despesas set
    descricao = p_descricao,
    categoria = p_categoria,
    valor = p_valor,
    frequencia = p_frequencia,
    parcelas_total = p_total,
    parcelas_restantes = p_restantes,
    parcelas_ref = case when p_frequencia = 'parcelada' then date_trunc('month', p_inicio)::date end,
    dia_vencimento = p_dia,
    inicio = p_inicio,
    cartao_id = null,
    essencial = true,
    ativo = p_ativo,
    updated_at = now()
  where id = v_id;

  -- Duplicadas da mesma conta: desativadas
  update public.fin_despesas set ativo = false, updated_at = now()
  where familia_id = v_familia and cartao_id is null and id <> v_id
    and descricao ilike any (p_busca) and not (descricao ilike any (p_excluir));

  -- Pendências dessa conta a partir de outubro saem (a de 02/10 do financiamento, por exemplo); pagas ficam
  delete from public.fin_lancamentos
  where despesa_id = v_id and pago = false and competencia >= date '2026-10-01';

  return v_id;
end $$;

-- Mês com valor ou data fora do padrão: lançamento "a pagar" exato
create or replace function pg_temp.parcela(p_despesa uuid, p_vencimento date, p_valor numeric)
returns void language plpgsql as $$
begin
  insert into public.fin_lancamentos
    (familia_id, user_id, data, vencimento, competencia, descricao, valor, categoria, cartao_id, origem, despesa_id, pago)
  select d.familia_id, d.user_id, p_vencimento, p_vencimento, date_trunc('month', p_vencimento)::date,
         d.descricao, p_valor, d.categoria, null, 'fixo', d.id, false
  from public.fin_despesas d where d.id = p_despesa;
end $$;

do $$
declare
  v uuid;
begin
  -- Financiamento da casa: todo mês, dia 2, a partir de 02/11/2026
  perform pg_temp.conta(array['%financiamento%', '%apartamento%'], array[]::text[],
    'Financiamento da casa', 'moradia', 4101.51, 'mensal', null, null, 2, date '2026-11-02', true);

  -- Cota condominial: fixa, dia 5
  perform pg_temp.conta(array['%condom%'], array['%extra%', '%mãe%', '%mae%'],
    'Cota condominial', 'moradia', 782.37, 'mensal', null, null, 5, date '2026-11-05', true);

  -- Cota extra do condomínio: parcela 2 de 5 em novembro (faltam 4, contando esta)
  perform pg_temp.conta(array['%cota extra%', '%extra%condom%'], array['%iptu%'],
    'Cota extra do condomínio', 'moradia', 509.92, 'parcelada', 5, 4, 5, date '2026-11-05', true);

  -- Energia: fixa, valor varia (novembro é o padrão; dezembro já conhecido)
  v := pg_temp.conta(array['%energia%', '%luz%', '%amazonas%'], array[]::text[],
    'Energia', 'contas', 1038.96, 'mensal', null, null, 5, date '2026-11-05', true);
  perform pg_temp.parcela(v, date '2026-12-05', 925.05);

  -- Internet Claro
  perform pg_temp.conta(array['%internet%', '%claro%'], array['%mãe%', '%mae%', '%mommy%'],
    'Internet Claro', 'contas', 149.00, 'mensal', null, null, 5, date '2026-11-05', true);

  -- Tim celular
  perform pg_temp.conta(array['%celular%', '%cellphone%'], array[]::text[],
    'Tim celular', 'contas', 99.99, 'mensal', null, null, 1, date '2026-11-01', true);

  -- Plano de saúde
  perform pg_temp.conta(array['%plano de sa%'], array[]::text[],
    'Plano de saúde', 'saude', 2079.00, 'mensal', null, null, 10, date '2026-11-10', true);

  -- IPTU: parcela 9 de 10 em 16/11, a 10ª em 15/12
  v := pg_temp.conta(array['%iptu%'], array[]::text[],
    'IPTU', 'moradia', 136.96, 'parcelada', 10, 2, 16, date '2026-11-16', true);
  perform pg_temp.parcela(v, date '2026-12-15', 136.96);

  -- Ajuda no condomínio da minha mãe: pausada por enquanto
  perform pg_temp.conta(array['%condom%mãe%', '%condom%mae%', '%ajuda%mãe%', '%ajuda%mae%'], array[]::text[],
    'Ajuda condomínio da mãe', 'moradia', 300.00, 'mensal', null, null, 5, date '2026-11-05', false);

  -- FIAP: faltam 3 (05/11, 07/12, 05/01)
  v := pg_temp.conta(array['%fiap%', '%fies%'], array[]::text[],
    'FIAP', 'educacao', 1315.00, 'parcelada', null, 3, 5, date '2026-11-05', true);
  perform pg_temp.parcela(v, date '2026-12-07', 1315.00);
end $$;

-- Conferência: as contas fora do cartão como ficaram
select descricao, valor, frequencia, parcelas_total, parcelas_restantes, dia_vencimento, inicio, ativo
from public.fin_despesas
where cartao_id is null
order by ativo desc, dia_vencimento nulls last, descricao;
