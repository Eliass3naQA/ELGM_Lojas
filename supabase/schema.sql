-- Schema inicial do LojaFlow para Supabase (Postgres).
-- Espelha src/lib/types.ts. Rode uma vez no SQL Editor do Supabase (projeto vazio).
-- O backend acessa o banco com a service role (ignora RLS); as políticas abaixo
-- protegem o acesso direto com a anon key e já preparam a migração para o Supabase Auth.

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

-- Identidade do comprador. Hoje o login é simulado (/api/auth/mock-oauth);
-- ao migrar para o Supabase Auth, users.id passa a ser o auth.uid().
create table users (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  name       text not null,
  provider   auth_provider not null,
  created_at timestamptz not null default now()
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
  position   int not null default 0,            -- ordem de exibição
  unique (product_id, options)
);
create unique index on product_variants (store_id, sku) where sku <> '';
create index on product_variants (product_id, position);

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
create index on stock_movements (store_id, product_id, at desc);

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
  user_id          uuid references users(id),          -- login Google/Microsoft/Apple
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
create index on orders (customer_id);

create index on customers (store_id, user_id);

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
alter table users       enable row level security;  -- sem políticas: só o backend acessa
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
-- (svg só para os comprovantes de demonstração do seed; uploads reais passam pela detecção de tipo do backend)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf','image/svg+xml']);

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

-- ---------------------------------------------------------------- Estoque e checkout
-- Erros de negócio: raise exception com a mensagem para o usuário; o hint, quando
-- presente, é o status HTTP (o backend converte em DomainError).

-- Produto com variações: products.stock = soma das variações.
create or replace function sync_product_stock() returns trigger
language plpgsql as $$
declare pid uuid;
begin
  if tg_op = 'DELETE' then pid := old.product_id; else pid := new.product_id; end if;
  update products set stock = (select coalesce(sum(stock), 0) from product_variants where product_id = pid)
   where id = pid and exists (select 1 from product_variants where product_id = pid);
  return null;
end $$;

create trigger product_variants_sync_stock
  after insert or update of stock or delete on product_variants
  for each row execute function sync_product_stock();

-- Entrada / saída / contagem manual, com histórico.
create or replace function adjust_stock(
  p_store_id uuid, p_product_id uuid, p_variant_id uuid, p_mode text, p_qty int,
  p_reason stock_reason, p_note text, p_actor text
) returns int
language plpgsql as $$
declare cur int; nxt int;
begin
  if p_variant_id is not null then
    select stock into cur from product_variants where id = p_variant_id and product_id = p_product_id and store_id = p_store_id for update;
  else
    select stock into cur from products where id = p_product_id and store_id = p_store_id for update;
  end if;
  if not found then raise exception 'Produto não encontrado.' using hint = '404'; end if;

  nxt := case p_mode when 'add' then cur + p_qty when 'remove' then cur - p_qty else p_qty end;
  if nxt < 0 then raise exception 'Não é possível retirar %: há apenas % em estoque.', p_qty, cur; end if;

  if p_variant_id is not null then
    update product_variants set stock = nxt where id = p_variant_id;
  else
    update products set stock = nxt where id = p_product_id;
  end if;
  if nxt <> cur then
    insert into stock_movements (store_id, product_id, variant_id, delta, balance_after, reason, note, actor)
    values (p_store_id, p_product_id, p_variant_id, nxt - cur, nxt, p_reason, p_note, p_actor);
  end if;
  return nxt;
end $$;

-- Checkout: baixa o estoque, consome o cupom e cria pedido + pagamento numa só transação.
-- Preços e totais já vêm calculados (e validados) pelo backend.
-- p_stock: [{productId, variantId, qty, label}] somente dos itens com controle de estoque.
create or replace function create_order(
  p_store_id uuid, p_customer_id uuid, p_items jsonb, p_stock jsonb,
  p_subtotal numeric, p_discount numeric, p_shipping numeric, p_total numeric,
  p_coupon_id uuid, p_coupon_code text, p_payment_method payment_method, p_address text
) returns orders
language plpgsql as $$
declare it jsonb; bal int; num int; o orders;
begin
  perform 1 from stores where id = p_store_id for update;  -- serializa os pedidos da loja (numeração)

  for it in select * from jsonb_array_elements(p_stock) loop
    if it->>'variantId' is not null then
      update product_variants set stock = stock - (it->>'qty')::int
       where id = (it->>'variantId')::uuid and store_id = p_store_id and stock >= (it->>'qty')::int
       returning stock into bal;
    else
      update products set stock = stock - (it->>'qty')::int
       where id = (it->>'productId')::uuid and store_id = p_store_id and stock >= (it->>'qty')::int
       returning stock into bal;
    end if;
    if not found then raise exception 'Estoque insuficiente para "%".', it->>'label' using hint = '409'; end if;
    insert into stock_movements (store_id, product_id, variant_id, delta, balance_after, reason, note, actor)
    values (p_store_id, (it->>'productId')::uuid, (it->>'variantId')::uuid, -(it->>'qty')::int, bal, 'sale', 'Venda', 'sistema');
  end loop;

  if p_coupon_id is not null then
    update coupons set uses = uses + 1 where id = p_coupon_id and (max_uses is null or uses < max_uses);
    if not found then raise exception 'Este cupom atingiu o limite de usos.'; end if;
  end if;

  select coalesce(max(number), 1000) + 1 into num from orders where store_id = p_store_id;
  insert into orders (number, store_id, customer_id, items, subtotal, discount, coupon_code, shipping, total, status, payment_method, address)
  values (num, p_store_id, p_customer_id, p_items, p_subtotal, p_discount, p_coupon_code, p_shipping, p_total, 'pending', p_payment_method, p_address)
  returning * into o;
  -- fica aguardando até o lojista aprovar o comprovante (ou o webhook do Mercado Pago)
  insert into payments (order_id, store_id, method, amount) values (o.id, p_store_id, p_payment_method, p_total);
  return o;
end $$;

-- Cancelamento: devolve ao estoque o que ainda existe e cancela o pagamento não aprovado.
create or replace function cancel_order(p_order_id uuid) returns orders
language plpgsql as $$
declare o orders; it jsonb; bal int; pid uuid; vid uuid; qty int;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.' using hint = '404'; end if;
  if o.status not in ('pending', 'paid') then raise exception 'Este pedido não pode mais ser cancelado.'; end if;

  update payments set status = 'cancelled' where order_id = o.id and status <> 'approved';

  for it in select * from jsonb_array_elements(o.items) loop
    pid := (it->>'productId')::uuid;
    vid := (it->>'variantId')::uuid;
    qty := (it->>'qty')::int;
    if not exists (select 1 from products where id = pid and track_stock) then continue; end if;
    if vid is not null then
      update product_variants set stock = stock + qty where id = vid returning stock into bal;
    else
      update products set stock = stock + qty
       where id = pid and not exists (select 1 from product_variants where product_id = pid)
       returning stock into bal;
    end if;
    if not found then continue; end if;
    insert into stock_movements (store_id, product_id, variant_id, delta, balance_after, reason, note, actor)
    values (o.store_id, pid, vid, qty, bal, 'cancel', format('Pedido #%s cancelado', o.number), 'sistema');
  end loop;

  update orders set status = 'cancelled', updated_at = now() where id = o.id returning * into o;
  return o;
end $$;

-- Só o backend (service role) pode chamar as funções de estoque e checkout.
revoke execute on function adjust_stock(uuid, uuid, uuid, text, int, stock_reason, text, text) from public, anon, authenticated;
revoke execute on function create_order(uuid, uuid, jsonb, jsonb, numeric, numeric, numeric, numeric, uuid, text, payment_method, text) from public, anon, authenticated;
revoke execute on function cancel_order(uuid) from public, anon, authenticated;

insert into plans values
  ('starter',    'Starter',     49, 2.5, 50,   array['Até 50 produtos','Loja personalizada','Pix e cartão','Suporte por e-mail']),
  ('pro',        'Pro',        149, 1.5, 1000, array['Até 1.000 produtos','Insights inteligentes','Cupons e frete grátis','Suporte prioritário']),
  ('enterprise', 'Enterprise', 499, 0.8, null, array['Produtos ilimitados','Domínio próprio','API e webhooks','Gerente de conta']);
