-- ============================================================
-- PAIDEIA REFORMADA — Schema Supabase
-- ============================================================

-- Tabela de perfis (espelha auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  name text,
  avatar_url text,
  anthropic_api_key text,
  ai_perfil text,
  ai_instrucoes text,
  created_at timestamptz default now()
);

-- Eixos temáticos (fixos, seed via SQL)
create table public.eixos (
  id serial primary key,
  nome text not null unique,
  icon text not null,
  cor text not null,
  total_planejado integer not null default 0
);

-- Livros
create table public.livros (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  titulo text not null,
  autor text,
  eixo_id integer references public.eixos(id),
  status text not null default 'quero'
    check (status in ('quero','comprar','lendo','lido','reler','abandonado')),
  nota integer check (nota between 1 and 5),
  data_inicio date,
  data_conclusao date,
  paginas integer,
  fichamento text,
  observacoes text,
  prioridade integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Citações
create table public.citacoes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  livro_id uuid references public.livros(id) on delete cascade,
  texto text not null,
  pagina integer,
  tags text[],
  created_at timestamptz default now()
);

-- Planos mensais
create table public.planos_mensais (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  numero_mes integer not null,
  ano integer not null,
  mes integer not null check (mes between 1 and 12),
  titulo text not null,
  objetivo text,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, numero_mes)
);

-- Livros vinculados a cada mês do plano
create table public.plano_livros (
  id uuid default gen_random_uuid() primary key,
  plano_id uuid references public.planos_mensais(id) on delete cascade not null,
  livro_id uuid references public.livros(id) on delete cascade not null,
  papel text not null default 'principal',
  ordem integer not null default 0,
  observacoes text,
  created_at timestamptz default now(),
  unique (plano_id, livro_id)
);

-- Caderno de pensamentos
create table public.pensamentos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  conteudo text not null,
  tags text[],
  livro_id uuid references public.livros(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.prosas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  titulo text not null default 'Prosa gerada',
  conteudo text not null,
  fontes jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.livros enable row level security;
alter table public.citacoes enable row level security;
alter table public.eixos enable row level security;
alter table public.planos_mensais enable row level security;
alter table public.plano_livros enable row level security;
alter table public.pensamentos enable row level security;
alter table public.prosas enable row level security;

-- Profiles: cada user vê só o próprio
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id);

-- Eixos: todos leem (tabela compartilhada)
create policy "eixos_read" on public.eixos
  for select using (true);

-- Livros: CRUD próprio
create policy "livros_own" on public.livros
  for all using (auth.uid() = user_id);

-- Citações: CRUD próprio
create policy "citacoes_own" on public.citacoes
  for all using (auth.uid() = user_id);

-- Planos mensais: CRUD próprio
create policy "planos_mensais_own" on public.planos_mensais
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Plano livros: CRUD dos vínculos pertencentes a planos próprios
create policy "plano_livros_own" on public.plano_livros
  for all using (
    exists (
      select 1
      from public.planos_mensais p
      where p.id = plano_livros.plano_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.planos_mensais p
      where p.id = plano_livros.plano_id
        and p.user_id = auth.uid()
    )
  );

-- Caderno: CRUD próprio
create policy "pensamentos_select" on public.pensamentos
  for select using (auth.uid() = user_id);

create policy "pensamentos_insert" on public.pensamentos
  for insert with check (auth.uid() = user_id);

create policy "pensamentos_update" on public.pensamentos
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "pensamentos_delete" on public.pensamentos
  for delete using (auth.uid() = user_id);

create policy "prosas_select" on public.prosas
  for select using (auth.uid() = user_id);

create policy "prosas_insert" on public.prosas
  for insert with check (auth.uid() = user_id);

create policy "prosas_delete" on public.prosas
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Trigger: atualiza updated_at em livros
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger livros_updated_at
  before update on public.livros
  for each row execute function public.set_updated_at();

create trigger planos_mensais_updated_at
  before update on public.planos_mensais
  for each row execute function public.set_updated_at();

create trigger pensamentos_updated_at
  before update on public.pensamentos
  for each row execute function public.set_updated_at();

-- Trigger: cria profile automaticamente ao criar user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- SEED: Eixos temáticos
-- ============================================================

insert into public.eixos (nome, icon, cor, total_planejado) values
  ('Teologia',        'Cross',        '#534AB7', 19),
  ('Conservadorismo', 'Landmark',     '#0F6E56', 13),
  ('Economia',        'Coins',        '#854F0B', 11),
  ('História',        'Map',          '#185FA5', 10),
  ('Literatura',      'BookOpen',     '#A32D2D', 23),
  ('Biografias',      'UserCircle',   '#3B6D11', 16),
  ('Música',          'Music',        '#993C1D', 13),
  ('Arte',            'Palette',      '#5F5E5A', 14);
