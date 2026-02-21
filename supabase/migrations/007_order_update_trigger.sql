-- ============================================================
-- Migration 007: Order Update & Delete Balance Triggers
-- Ensures customer balance stays in sync when orders are
-- edited or deleted.
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. AFTER UPDATE trigger on orders
--    Adjusts customer balance by the difference in total_price.
CREATE OR REPLACE FUNCTION public.update_balance_on_order_update()
RETURNS TRIGGER AS $$
DECLARE
    price_diff NUMERIC;
BEGIN
    price_diff := NEW.total_price - OLD.total_price;

    IF price_diff <> 0 THEN
        UPDATE public.customers
        SET current_balance = current_balance + price_diff
        WHERE id = NEW.customer_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_update
AFTER UPDATE OF total_price ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_balance_on_order_update();

-- 2. AFTER DELETE trigger on orders
--    Subtracts the deleted order's total_price from customer balance.
CREATE OR REPLACE FUNCTION public.update_balance_on_order_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.customers
    SET current_balance = current_balance - OLD.total_price
    WHERE id = OLD.customer_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_delete
AFTER DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_balance_on_order_delete();
