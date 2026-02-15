-- ============================================================
-- Migration: Switch FK constraints from CASCADE to RESTRICT
-- This prevents accidental deletion of orders/payments
-- when a customer is deleted.
-- ============================================================

-- Fix orders -> customers FK
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;

ALTER TABLE public.orders
ADD CONSTRAINT orders_customer_id_fkey
FOREIGN KEY (customer_id)
REFERENCES public.customers (id)
ON DELETE RESTRICT;

-- Fix payments -> customers FK
ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_customer_id_fkey;

ALTER TABLE public.payments
ADD CONSTRAINT payments_customer_id_fkey
FOREIGN KEY (customer_id)
REFERENCES public.customers (id)
ON DELETE RESTRICT;
