-- Paideia Ekos — planos e cenários (mudança, estudo, reserva, quitar dívidas...)

create table if not exists public.fin_planos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  descricao text,
  status text not null default 'ideia' check (status in ('ideia', 'ativo', 'pausado', 'concluido')),
  moeda text not null default 'BRL' check (moeda in ('BRL', 'USD')),
  cotacao numeric(8,4), -- R$ por US$, informado pelo usuário quando moeda = USD
  valor_guardado numeric(12,2) not null default 0 check (valor_guardado >= 0), -- na moeda do plano
  aporte_mensal numeric(12,2) not null default 0 check (aporte_mensal >= 0),   -- sempre em R$
  data_alvo date,
  prioridade int not null default 0,
  -- Custos que formam a meta: [{ "descricao": "Visto F-1", "valor": 350 }]
  itens jsonb not null default '[]'::jsonb,
  -- Passos para realizar o plano: [{ "texto": "Pesquisar LL.M.", "feito": false }]
  etapas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_planos_user_idx on public.fin_planos(user_id);

alter table public.fin_planos enable row level security;

create policy "fin_planos_own" on public.fin_planos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
