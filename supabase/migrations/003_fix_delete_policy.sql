-- Allow anonymous users to DELETE from customers table
CREATE POLICY "Enable delete for anon" ON "public"."customers"
AS PERMISSIVE FOR DELETE
TO anon
USING (true);
