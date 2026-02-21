-- ============================================================
-- Migration 006: Advanced Features
-- Products, Order Items, Customer Discounts, Payment Details
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. PRODUCTS TABLE
-- ============================================================

CREATE TABLE public.products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL UNIQUE,
    price       DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock       INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. ORDER ITEMS TABLE (multiple products per order)
-- ============================================================

CREATE TABLE public.order_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity    INTEGER NOT NULL,
    unit_price  DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id   ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);

-- ============================================================
-- 3. CUSTOMERS – add discount columns
-- ============================================================

ALTER TABLE public.customers
    ADD COLUMN discount_type  VARCHAR(20) NOT NULL DEFAULT 'none',
    ADD COLUMN discount_value DECIMAL(10,2) NOT NULL DEFAULT 0;

-- ============================================================
-- 4. PAYMENTS – add payment method & description
-- ============================================================

ALTER TABLE public.payments
    ADD COLUMN payment_method VARCHAR(50) NOT NULL DEFAULT 'Nakit',
    ADD COLUMN description    TEXT;

-- ============================================================
-- 5. ROW LEVEL SECURITY for new tables
-- ============================================================

ALTER TABLE public.products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Products – authenticated
CREATE POLICY "Authenticated users can manage products"
ON public.products FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Products – anon (dev)
CREATE POLICY "Anon can read products"
ON public.products FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon can insert products"
ON public.products FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon can update products"
ON public.products FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon can delete products"
ON public.products FOR DELETE
TO anon
USING (true);

-- Order Items – authenticated
CREATE POLICY "Authenticated users can manage order_items"
ON public.order_items FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Order Items – anon (dev)
CREATE POLICY "Anon can read order_items"
ON public.order_items FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon can insert order_items"
ON public.order_items FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon can update order_items"
ON public.order_items FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon can delete order_items"
ON public.order_items FOR DELETE
TO anon
USING (true);

-- ============================================================
-- 6. DATA MIGRATION – seed default product & migrate orders
-- ============================================================

-- 6a. Insert default product
INSERT INTO public.products (id, name, price, stock)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Genel Lavaş',
    5.00,
    0
);

-- 6b. Copy existing order rows into order_items
--     Each order becomes a single order_item with the default product.
INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
SELECT
    o.id,
    '00000000-0000-0000-0000-000000000001',
    o.quantity,
    o.unit_price,
    o.total_price
FROM public.orders o;
