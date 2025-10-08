-- Helper Functions for n8n Workflows
-- Run these in Supabase SQL Editor if they don't exist

-- Function: Get or create bookmark
CREATE OR REPLACE FUNCTION get_or_create_bookmark(
  p_source TEXT,
  p_query_sig TEXT
) RETURNS TABLE (
  id BIGINT,
  source TEXT,
  query_sig TEXT,
  last_page_fetched INTEGER,
  last_seen_vendor_id TEXT,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Try to insert, on conflict do nothing
  INSERT INTO source_bookmarks (source, query_sig, last_page_fetched, updated_at)
  VALUES (p_source, p_query_sig, 0, NOW())
  ON CONFLICT (source, query_sig) DO NOTHING;
  
  -- Return the row (existing or just created)
  RETURN QUERY
  SELECT * FROM source_bookmarks
  WHERE source_bookmarks.source = p_source 
    AND source_bookmarks.query_sig = p_query_sig;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_or_create_bookmark IS 'Get existing bookmark or create new one with page 0';

-- Test it
SELECT * FROM get_or_create_bookmark('batchdata', 'test-sig-123');

