-- Paideia Ekos — lançamento marcado como essencial ou não
-- null = segue o padrão da categoria (lazer, assinaturas, pessoais e outros contam como não essenciais)

alter table public.fin_lancamentos
  add column if not exists essencial boolean;

-- A tabela já tem GRANT para authenticated (ekos_permissoes.sql); coluna nova herda a permissão
