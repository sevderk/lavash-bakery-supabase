-- ============================================================
-- Add order_group_id to orders table
-- Groups all orders from a single daily batch together
-- Run this in the Supabase SQL Editor
-- ============================================================

ALTER TABLE orders ADD COLUMN order_group_id UUID;

CREATE INDEX idx_orders_group_id ON orders(order_group_id);
