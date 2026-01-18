-- ============================================
-- KCU Coach - Allow public read for economic events
-- ============================================

-- Allow unauthenticated reads for economic events (public data)
DROP POLICY IF EXISTS "Public can read economic events" ON economic_events;
CREATE POLICY "Public can read economic events"
ON economic_events FOR SELECT
TO anon
USING (true);
