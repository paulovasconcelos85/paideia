-- Paideia Ekos — dólar, carta mensal, lembretes no celular e eixo Mordomia
-- Rode depois de ekos_familia.sql

-- Compras de dólar: o preço médio sai daqui e o valor atual vem da PTAX do Banco Central
create table if not exists public.fin_compras_dolar (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.fin_familias(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null default current_date,
  valor_usd numeric(12,2) not null check (valor_usd > 0),
  valor_brl numeric(12,2) not null check (valor_brl > 0), -- total pago, com IOF e spread
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists fin_compras_dolar_familia_idx on public.fin_compras_dolar(familia_id);

-- Carta mensal do consultor
create table if not exists public.fin_cartas (
  familia_id uuid not null references public.fin_familias(id) on delete cascade,
  mes date not null, -- mês em que a carta foi escrita (fala do mês anterior)
  texto text not null,
  created_at timestamptz not null default now(),
  primary key (familia_id, mes)
);

-- Inscrições de notificação (Web Push), uma por aparelho
create table if not exists public.fin_push (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  familia_id uuid not null references public.fin_familias(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.fin_compras_dolar enable row level security;
alter table public.fin_cartas enable row level security;
alter table public.fin_push enable row level security;

create policy "fin_compras_dolar_familia" on public.fin_compras_dolar
  for all using (fin_is_membro(familia_id)) with check (fin_is_membro(familia_id));

create policy "fin_cartas_familia" on public.fin_cartas
  for all using (fin_is_membro(familia_id)) with check (fin_is_membro(familia_id));

create policy "fin_push_own" on public.fin_push
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id and fin_is_membro(familia_id));

-- Novo eixo de leitura na Biblioteca
insert into public.eixos (nome, icon, cor, total_planejado)
values ('Mordomia', 'HandCoins', '#B45309', 7)
on conflict (nome) do nothing;
