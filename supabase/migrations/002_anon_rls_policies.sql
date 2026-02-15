-- ============================================================
-- Temporary Anon RLS Policies for Development
-- These allow the anon role (unauthenticated) to read and insert.
-- REMOVE these once Authentication is implemented!
-- ============================================================

-- Customers: anon can SELECT and INSERT
CREATE POLICY "Anon can read customers"
ON customers FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon can insert customers"
ON customers FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon can update customers"
ON customers FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Orders: anon can SELECT and INSERT
CREATE POLICY "Anon can read orders"
ON orders FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon can insert orders"
ON orders FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon can update orders"
ON orders FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Payments: anon can SELECT and INSERT
CREATE POLICY "Anon can read payments"
ON payments FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon can insert payments"
ON payments FOR INSERT
TO anon
WITH CHECK (true);
