-- =====================================================================
-- Controle Financeiro - schema do banco (Supabase / PostgreSQL)
-- ---------------------------------------------------------------------
-- Como usar:
--   1. Crie um projeto gratuito em https://supabase.com
--   2. Abra "SQL Editor" > "New query"
--   3. Cole TODO este arquivo e clique em "Run"
-- Isso cria as tabelas, a segurança por usuário (RLS) e dados de exemplo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- TABELAS
-- ---------------------------------------------------------------------

-- Lançamentos (receitas e despesas)
create table if not exists public.transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date           date not null default current_date,
  description    text,
  establishment  text,
  category       text,
  payment_method text,
  tag            text,
  amount         numeric(14,2) not null default 0,        -- sempre positivo
  type           text not null default 'saida' check (type in ('entrada','saida')),
  created_at     timestamptz not null default now()
);

-- Plano: meta de gasto por categoria por mês (mês no formato 'YYYY-MM')
create table if not exists public.budgets (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month     text not null,                                 -- ex: '2026-03'
  category  text not null,
  planned   numeric(14,2) not null default 0,              -- meta
  icon      text,
  created_at timestamptz not null default now(),
  unique (user_id, month, category)
);

-- Contas e cartões
create table if not exists public.accounts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name         text not null,
  institution  text,
  kind         text not null default 'conta' check (kind in ('conta','cartao')),
  balance      numeric(14,2) not null default 0,           -- saldo conta corrente
  invested     numeric(14,2) not null default 0,           -- investimentos na conta
  credit_limit numeric(14,2) not null default 0,           -- limite do cartão
  used         numeric(14,2) not null default 0,           -- usado do cartão
  created_at   timestamptz not null default now()
);

-- Patrimônio: ativos e passivos
create table if not exists public.assets (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name              text not null,
  category          text not null default 'investimento'
                    check (category in ('investimento','bem_movel','bem_imovel','divida','financiamento')),
  value             numeric(14,2) not null default 0,
  income_generating boolean not null default false,        -- gera renda?
  created_at        timestamptz not null default now()
);

-- Investimentos (carteira detalhada)
create table if not exists public.investments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product     text not null,
  asset_class text,                                        -- Ações, CDB, Título público...
  category    text,                                        -- Renda fixa / Renda variável
  liquidity   text,
  institution text,
  value       numeric(14,2) not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SEGURANÇA POR USUÁRIO (Row Level Security)
-- Cada pessoa só enxerga e edita os próprios dados.
-- ---------------------------------------------------------------------

alter table public.transactions enable row level security;
alter table public.budgets      enable row level security;
alter table public.accounts     enable row level security;
alter table public.assets       enable row level security;
alter table public.investments  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['transactions','budgets','accounts','assets','investments']
  loop
    execute format('drop policy if exists "own rows select" on public.%I;', t);
    execute format('drop policy if exists "own rows insert" on public.%I;', t);
    execute format('drop policy if exists "own rows update" on public.%I;', t);
    execute format('drop policy if exists "own rows delete" on public.%I;', t);

    execute format('create policy "own rows select" on public.%I for select using (auth.uid() = user_id);', t);
    execute format('create policy "own rows insert" on public.%I for insert with check (auth.uid() = user_id);', t);
    execute format('create policy "own rows update" on public.%I for update using (auth.uid() = user_id);', t);
    execute format('create policy "own rows delete" on public.%I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- ÍNDICES úteis
-- ---------------------------------------------------------------------
create index if not exists idx_tx_user_date on public.transactions(user_id, date);
create index if not exists idx_tx_user_cat  on public.transactions(user_id, category);
create index if not exists idx_budget_user_month on public.budgets(user_id, month);

-- =====================================================================
-- FIM. Os dados de exemplo podem ser inseridos depois pelo próprio app
-- (botão "Carregar dados de exemplo" na tela de Lançamentos), já que o
-- INSERT precisa do seu user_id após você criar a conta no app.
-- =====================================================================
