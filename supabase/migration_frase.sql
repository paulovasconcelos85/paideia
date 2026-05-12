-- Migração: adiciona campo frase à tabela prosas
-- Execute no SQL Editor do Supabase Dashboard

alter table public.prosas
  add column if not exists frase text;
