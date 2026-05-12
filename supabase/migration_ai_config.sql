-- Migração: adiciona campos de configuração da IA ao profiles
-- Execute no SQL Editor do Supabase Dashboard

alter table public.profiles
  add column if not exists anthropic_api_key text,
  add column if not exists ai_perfil text,
  add column if not exists ai_instrucoes text;
