-- ============================================================
-- Migration: Auto-mark pending orders as 'delivered'
-- when a customer's balance drops to zero or below.
-- ============================================================

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.mark_orders_paid_on_zero_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_balance <= 0 THEN
        UPDATE public.orders
        SET status = 'delivered'
        WHERE customer_id = NEW.id
          AND status = 'pending';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger on customers table
DROP TRIGGER IF EXISTS tr_auto_complete_orders ON public.customers;

CREATE TRIGGER tr_auto_complete_orders
AFTER UPDATE OF current_balance
ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.mark_orders_paid_on_zero_balance();
