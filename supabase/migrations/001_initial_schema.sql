-- ============================================================
-- Lavash Bakery Management App - Initial Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Custom ENUM type for order status
CREATE TYPE order_status AS ENUM ('pending', 'delivered');

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    current_balance NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    status order_status NOT NULL DEFAULT 'pending',
    order_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    note TEXT
);

-- ============================================================
-- 3. INDEXES  (speed up customer-scoped queries)
-- ============================================================

CREATE INDEX idx_orders_customer_id   ON orders(customer_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);

-- ============================================================
-- 4. TRIGGER FUNCTIONS & TRIGGERS
-- ============================================================

-- When a new order is inserted → INCREASE customer balance
CREATE OR REPLACE FUNCTION update_balance_on_order()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE customers
    SET current_balance = current_balance + NEW.total_price
    WHERE id = NEW.customer_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_insert
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION update_balance_on_order();

-- When a new payment is inserted → DECREASE customer balance
CREATE OR REPLACE FUNCTION update_balance_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE customers
    SET current_balance = current_balance - NEW.amount
    WHERE id = NEW.customer_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_insert
AFTER INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION update_balance_on_payment();

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments  ENABLE ROW LEVEL SECURITY;

-- Permissive policies for authenticated users (tighten later as needed)
CREATE POLICY "Authenticated users can manage customers"
ON customers FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can manage orders"
ON orders FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can manage payments"
ON payments FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
