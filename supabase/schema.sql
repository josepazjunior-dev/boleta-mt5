-- Execute este arquivo no SQL Editor do Supabase.
create extension if not exists pgcrypto;

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_cliente uuid not null unique default gen_random_uuid(),
  mercado_pago_preference_id text unique,
  mercado_pago_payment_id text unique,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','refunded')),
  valor_centavos integer not null default 1990 check (valor_centavos = 1990),
  criado_em timestamptz not null default now(),
  aprovado_em timestamptz
);

create index if not exists pedidos_email_idx on public.pedidos (lower(email));
create index if not exists pedidos_status_idx on public.pedidos (status);

alter table public.pedidos enable row level security;
-- Não há policies públicas: somente as Edge Functions, usando service role,
-- podem ler ou alterar pedidos. Isso impede alguém de se declarar comprador.

insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', false)
on conflict (id) do update set public = false;

-- O arquivo permanece privado; o download é liberado por URL assinada somente
-- quando a função confirmar que o pedido está aprovado.
