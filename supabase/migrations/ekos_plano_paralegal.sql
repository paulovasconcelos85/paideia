-- Paideia Ekos — valores-base do plano "Trabalhar como paralegal nos EUA"
--
-- ESTIMATIVAS (preços de 2024–2025), só para ter uma base até a consulta com o advogado de imigração.
-- Família de 3, cidade de custo médio (ex.: Flórida). Em Boston, o custo de vida fica ~35% maior.
-- A faixa típica vai no nome de cada item. Atualiza o plano existente; se não houver, cria.

do $$
declare
  v_itens jsonb := '[
    {"descricao": "Certificado de paralegal ABA (estimativa: US$ 3–9 mil)", "valor": 6000},
    {"descricao": "Certificação NALA CP ou NFPA (est.: US$ 250–350)", "valor": 300},
    {"descricao": "Validação dos 3 diplomas, WES/ECE (est.: US$ 600–900)", "valor": 750},
    {"descricao": "Teste de inglês TOEFL/IELTS (est.: US$ 200–280)", "valor": 250},
    {"descricao": "Visto da família + advogado de imigração (est.: US$ 3–15 mil)", "valor": 7500},
    {"descricao": "Passagens só de ida (3) e mudança (est.: US$ 2,5–5 mil)", "valor": 3500},
    {"descricao": "Custo de vida até o 1º salário, 6 meses (est.: US$ 25–45 mil)", "valor": 33000},
    {"descricao": "Seguro saúde da família, 6 meses (est.: US$ 6–12 mil)", "valor": 9000},
    {"descricao": "Reserva de chegada: caução, carro usado, móveis (est.: US$ 10–20 mil)", "valor": 15000}
  ]';
  v_familia uuid;
  v_user uuid;
  v_n int;
begin
  select familia_id, user_id into v_familia, v_user from public.fin_membros where papel = 'titular' limit 1;

  update public.fin_planos
  set itens = v_itens, moeda = 'USD', updated_at = now()
  where familia_id = v_familia and titulo ilike '%paralegal%';
  get diagnostics v_n = row_count;

  if v_n = 0 then
    insert into public.fin_planos (familia_id, user_id, titulo, descricao, moeda, status, itens, etapas)
    values (v_familia, v_user, 'Trabalhar como paralegal nos EUA',
      'Atuar na área jurídica nos EUA. O ponto crítico é a autorização de trabalho (visto).',
      'USD', 'pausado', v_itens,
      '[{"texto": "Consultar advogado de imigração: qual visto me permitiria trabalhar como paralegal?", "feito": false},
        {"texto": "Pesquisar se paralegal se qualifica como \"specialty occupation\" para H-1B (em geral é difícil)", "feito": false},
        {"texto": "Avaliar caminho via estudo: certificado ou LL.M. com F-1 e depois OPT", "feito": false},
        {"texto": "Fazer validação dos diplomas", "feito": false},
        {"texto": "Montar currículo no padrão americano e LinkedIn em inglês", "feito": false}]');
  end if;

  raise notice 'Plano paralegal: % atualizado(s)%', v_n, case when v_n = 0 then ' (criado novo)' else '' end;
end $$;

-- Conferência
select titulo, moeda, cotacao, (select sum((i->>'valor')::numeric) from jsonb_array_elements(itens) i) as total_usd
from public.fin_planos where titulo ilike '%paralegal%';
