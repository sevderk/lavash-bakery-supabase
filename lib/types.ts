/** Matches the `customers` table in Supabase */
export interface Customer {
    id: string;
    name: string;
    phone: string | null;
    current_balance: number;
    created_at: string;
}

/** Matches the `order_status` enum in Supabase */
export type OrderStatus = 'pending' | 'delivered';

/** Matches the `orders` table in Supabase */
export interface Order {
    id: string;
    customer_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    status: OrderStatus;
    order_date: string;
    order_group_id: string | null;
}

/** Matches the `payments` table in Supabase */
export interface Payment {
    id: string;
    customer_id: string;
    amount: number;
    payment_date: string;
    note: string | null;
}
