-- Paideia Ekos — permissões de tabela para a API do Supabase
-- Projetos recentes do Supabase não liberam tabelas novas automaticamente para os papéis da API.
-- Sem estes GRANTs, toda leitura e gravação falha com 42501 ("permission denied") antes mesmo do RLS.
-- O RLS de cada tabela continua decidindo QUAIS linhas cada usuário vê e altera.

-- Usuários logados: dados da família (o RLS restringe aos membros)
grant select, insert, update, delete on
  public.fin_despesas,
  public.fin_rendas,
  public.fin_planos,
  public.fin_cartoes,
  public.fin_lancamentos,
  public.fin_contas,
  public.fin_dividas,
  public.fin_fechamentos,
  public.fin_compras_dolar,
  public.fin_cartas,
  public.fin_push
to authenticated;

-- Família, membros e convites: só leitura/renomear; entrar e convidar passam pelas funções
grant select, update on public.fin_familias to authenticated;
grant select on public.fin_membros, public.fin_convites to authenticated;

grant execute on function
  public.fin_is_membro(uuid),
  public.fin_minha_familia(),
  public.fin_criar_convite(),
  public.fin_entrar_familia(text),
  public.fin_membros_familia()
to authenticated;

-- Cron diário (carta do mês e lembretes) usa a service role
grant all on
  public.fin_despesas, public.fin_rendas, public.fin_planos, public.fin_cartoes,
  public.fin_lancamentos, public.fin_contas, public.fin_dividas, public.fin_fechamentos,
  public.fin_compras_dolar, public.fin_cartas, public.fin_push,
  public.fin_familias, public.fin_membros, public.fin_convites
to service_role;
