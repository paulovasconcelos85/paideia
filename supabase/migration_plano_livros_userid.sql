-- Corrige coluna user_id em plano_livros: torna nullable
-- (user_id é redundante aqui; propriedade é derivada via plano_id → planos_mensais.user_id)
-- Execute no SQL Editor do Supabase Dashboard

alter table public.plano_livros
  alter column user_id drop not null;
