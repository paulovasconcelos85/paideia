-- ============================================================
-- PAIDEIA REFORMADA — Schema Supabase
-- ============================================================

-- Tabela de perfis (espelha auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  name text,
  avatar_url text,
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

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.livros enable row level security;
alter table public.citacoes enable row level security;
alter table public.eixos enable row level security;

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
