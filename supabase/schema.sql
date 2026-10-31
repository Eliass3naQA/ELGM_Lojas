-- Schema inicial do LojaFlow para Supabase (Postgres).
-- Espelha src/lib/types.ts. Rode no SQL Editor do Supabase quando for conectar.

create extension if not exists "pgcrypto";

create type plan_id      as enum ('starter', 'pro', 'enterprise');
create type store_status as enum ('active', 'trial', 'suspended');
create type order_status as enum ('pending', 'paid', 'shipped', 'delivered', 'cancelled');
create type payment_method as enum ('pix', 'card', 'boleto');
create type payment_status as enum ('awaiting', 'in_review', 'approved', 'rejected', 'cancelled');
create type auth_provider  as enum ('google', 'microsoft', 'apple');
create type stock_reason   as enum ('initial', 'sale', 'cancel', 'restock', 'adjustment', 'loss', 'return');
create type coupon_type    as enum ('percent', 'fixed', 'free_shipping');

create table plans (
  id            plan_id primary key,
  name          text not null,
  price_monthly numeric(10,2) not null,
  fee_percent   numeric(5,2) not null,
  max_products  int,
  features      text[] not null default '{}'
);

create table stores (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name                text not null,
  tagline             text not null default '',
  category            text not null,
  logo                text not null default '🛍️',     -- emoji de reserva
  logo_url            text,
  cover_url           text,
  about               text not null default '',
  whatsapp            text,
  instagram           text,
  brand_color         text not null default '#6366f1',
  owner_id            uuid references auth.users(id),
  owner_name          text not null,
  owner_email         text not null,
  plan_id             plan_id not null references plans(id),
  status              store_status not null default 'trial',
  shipping_flat       numeric(10,2) not null default 19.90,
  free_shipping_over  numeric(10,2),
  pix_key             text not null,
  custom_terms        text,                                -- null = modelo padrão
  terms_updated_at    timestamptz not null default now(),  -- versão dos termos
  created_at          timestamptz not null default now()
);

create table products (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references stores(id) on delete cascade,
  name             text not null,
  description      text not null default '',
  price            numeric(10,2) not null check (price > 0),
  promo_price      numeric(10,2) check (promo_price < price),
  promo_starts_at  timestamptz,
  promo_ends_at    timestamptz,
  sku              text not null default '',
  track_stock      boolean not null default true,
  stock            int not null default 0 check (stock >= 0),  -- com variações: soma (mantida por trigger)
  low_stock_threshold int not null default 5,
  options          jsonb not null default '[]',               -- [{name, values[]}], máx. 3
  category         text not null,
  image            text not null default '📦',
  images           text[] not null default '{}',              -- URLs do bucket "media"; a 1ª é a principal
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);
create index on products (store_id);

create table product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  store_id   uuid not null references stores(id) on delete cascade,
  options    jsonb not null,                    -- {"Tamanho":"M","Cor":"Preto"}
  sku        text not null default '',
  stock      int not null default 0 check (stock >= 0),
  price      numeric(10,2),                     -- null = preço do produto
  unique (product_id, options)
);
create unique index on product_variants (store_id, sku) where sku <> '';

create table stock_movements (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores(id) on delete cascade,
  product_id    uuid not null,                  -- sem FK: o histórico sobrevive à exclusão do produto
  variant_id    uuid,
  delta         int not null,
  balance_after int not null,
  reason        stock_reason not null,
  note          text not null default '',
  actor         text not null,
  at            timestamptz not null default now()
);
create index on stock_movements (store_id, at desc);

create table coupons (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores(id) on delete cascade,
  code         text not null,
  type         coupon_type not null,
  value        numeric(10,2) not null default 0,
  min_subtotal numeric(10,2) not null default 0,
  starts_at    timestamptz,
  ends_at      timestamptz,
  max_uses     int,
  uses         int not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (store_id, code)
);

create table customers (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores(id) on delete cascade,
  user_id          uuid references auth.users(id),     -- login Google/Microsoft/Apple (Supabase Auth)
  provider         auth_provider,
  name             text not null,
  email            text not null,
  phone            text not null,
  city             text not null,
  cpf              text,
  birth_date       date,
  address          jsonb,                              -- {cep, street, number, complement, district, city, state}
  accepted_terms_at timestamptz,
  terms_version    timestamptz,                        -- = stores.terms_updated_at no momento do aceite
  marketing_opt_in boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (store_id, email)
);

create table orders (
  id             uuid primary key default gen_random_uuid(),
  number         int not null,
  store_id       uuid not null references stores(id) on delete cascade,
  customer_id    uuid not null references customers(id),
  items          jsonb not null, -- [{productId, variantId, variantLabel, name, image, imageUrl, price, qty}] (snapshot)
  subtotal       numeric(10,2) not null,
  discount       numeric(10,2) not null default 0,
  coupon_code    text,
  shipping       numeric(10,2) not null,
  total          numeric(10,2) not null,
  status         order_status not null,
  payment_method payment_method not null,
  tracking_code  text,
  address        text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (store_id, number)
);
create index on orders (store_id, created_at desc);

create table payments (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null unique references orders(id) on delete cascade,
  store_id         uuid not null references stores(id) on delete cascade,
  provider         text not null default 'manual',     -- 'manual' | 'mercadopago'
  method           payment_method not null,
  amount           numeric(10,2) not null,
  status           payment_status not null default 'awaiting',
  receipt_path     text,                               -- caminho no bucket "receipts"
  receipt_name     text,
  receipt_mime     text,
  receipt_size     int,
  submitted_at     timestamptz,
  reviewed_at      timestamptz,
  reviewed_by      text,
  rejection_reason text,
  external_id      text,                               -- id do pagamento no Mercado Pago
  created_at       timestamptz not null default now()
);
create index on payments (store_id, status);

create table audit_logs (
  id     uuid primary key default gen_random_uuid(),
  at     timestamptz not null default now(),
  actor  text not null,
  action text not null,
  target text not null
);

-- Admins da plataforma (backoffice).
create table platform_admins (user_id uuid primary key references auth.users(id));

create or replace function is_platform_admin() returns boolean
language sql stable security definer as $$
  select exists (select 1 from platform_admins where user_id = auth.uid())
$$;

create or replace function owns_store(sid uuid) returns boolean
language sql stable security definer as $$
  select exists (select 1 from stores where id = sid and owner_id = auth.uid())
$$;

-- ---------------------------------------------------------------- RLS
alter table plans       enable row level security;
alter table stores      enable row level security;
alter table products    enable row level security;
alter table customers   enable row level security;
alter table orders      enable row level security;
alter table audit_logs  enable row level security;
alter table payments    enable row level security;
alter table product_variants enable row level security;
alter table stock_movements  enable row level security;
alter table coupons          enable row level security;

create policy "vitrine vê variações"    on product_variants for select using (true);
create policy "dono gerencia variações" on product_variants for all using (owns_store(store_id) or is_platform_admin());
create policy "dono vê movimentações"   on stock_movements for select using (owns_store(store_id) or is_platform_admin());
create policy "dono gerencia cupons"    on coupons for all using (owns_store(store_id) or is_platform_admin());
-- a vitrine NÃO lê cupons direto (evita listar códigos): a validação é feita pelo backend.

create policy "planos públicos" on plans for select using (true);

create policy "vitrine vê lojas não suspensas" on stores for select using (status <> 'suspended' or owns_store(id) or is_platform_admin());
create policy "dono edita sua loja"            on stores for update using (owns_store(id)) with check (owns_store(id));
create policy "admin gerencia lojas"           on stores for all using (is_platform_admin());

create policy "vitrine vê produtos ativos" on products for select using (active or owns_store(store_id) or is_platform_admin());
create policy "dono gerencia produtos"     on products for all using (owns_store(store_id) or is_platform_admin());

create policy "dono vê clientes"      on customers for select using (owns_store(store_id) or is_platform_admin() or user_id = auth.uid());
create policy "dono/comprador pedidos" on orders for select using (
  owns_store(store_id) or is_platform_admin()
  or customer_id in (select id from customers where user_id = auth.uid())
);
create policy "dono atualiza pedidos" on orders for update using (owns_store(store_id) or is_platform_admin());

create policy "admin vê auditoria" on audit_logs for select using (is_platform_admin());

create policy "comprador cadastra o próprio perfil" on customers for insert with check (user_id = auth.uid());
create policy "comprador edita o próprio perfil"    on customers for update using (user_id = auth.uid());

create policy "pagamentos: dono, admin e comprador" on payments for select using (
  owns_store(store_id) or is_platform_admin()
  or order_id in (select o.id from orders o join customers c on c.id = o.customer_id where c.user_id = auth.uid())
);
create policy "dono analisa pagamentos" on payments for update using (owns_store(store_id) or is_platform_admin());

-- Fotos da loja e dos produtos: bucket PÚBLICO "media", caminho {store_id}/{arquivo}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg','image/png','image/webp']);
create policy "dono envia fotos" on storage.objects for insert with check (bucket_id = 'media' and owns_store((storage.foldername(name))[1]::uuid));
create policy "dono apaga fotos" on storage.objects for delete using (bucket_id = 'media' and owns_store((storage.foldername(name))[1]::uuid));

-- Comprovantes: bucket PRIVADO "receipts", caminho {store_id}/{order_id}/{arquivo}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf']);

create policy "comprador envia comprovante" on storage.objects for insert with check (
  bucket_id = 'receipts' and (storage.foldername(name))[2]::uuid in (
    select o.id from orders o join customers c on c.id = o.customer_id where c.user_id = auth.uid()
  )
);
create policy "dono e comprador leem comprovante" on storage.objects for select using (
  bucket_id = 'receipts' and (
    owns_store((storage.foldername(name))[1]::uuid) or is_platform_admin()
    or (storage.foldername(name))[2]::uuid in (select o.id from orders o join customers c on c.id = o.customer_id where c.user_id = auth.uid())
  )
);

-- O checkout (inserir cliente + pedido + baixar estoque) deve ser uma função
-- transacional chamada pelo backend com a service role, ex.: rpc('create_order', ...).

insert into plans values
  ('starter',    'Starter',     49, 2.5, 50,   array['Até 50 produtos','Loja personalizada','Pix e cartão','Suporte por e-mail']),
  ('pro',        'Pro',        149, 1.5, 1000, array['Até 1.000 produtos','Insights inteligentes','Cupons e frete grátis','Suporte prioritário']),
  ('enterprise', 'Enterprise', 499, 0.8, null, array['Produtos ilimitados','Domínio próprio','API e webhooks','Gerente de conta']);
