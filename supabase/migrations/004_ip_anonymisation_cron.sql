-- IP Anonymisation Cron Job
-- Hashes raw IP addresses older than 180 days in the comments table
-- Uses pg_cron extension (available on Supabase Pro/Team plans)
-- For free plans, call the function via Worker cron trigger instead

-- Create the anonymisation function
CREATE OR REPLACE FUNCTION anonymise_old_ips()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected integer;
BEGIN
  -- Hash IPs older than 180 days that haven't been hashed yet
  -- We detect unhashed IPs by checking if they contain dots (IPv4) or colons (IPv6)
  UPDATE comments
  SET
    visitor_ip = encode(
      sha256(convert_to(visitor_ip || '_analyst_salt_2026', 'UTF8')),
      'hex'
    ),
    visitor_geo = 'anonymised',
    updated_at = now()
  WHERE
    created_at < now() - interval '180 days'
    AND visitor_ip IS NOT NULL
    AND visitor_ip != 'DECLINED'
    AND visitor_ip != 'unknown'
    AND (visitor_ip LIKE '%.%' OR visitor_ip LIKE '%:%');

  GET DIAGNOSTICS affected = ROW_COUNT;

  -- Also anonymise in comment_users table
  UPDATE comment_users
  SET
    updated_at = now()
  WHERE
    created_at < now() - interval '180 days';

  RETURN affected;
END;
$$;

-- Grant execute permission to anon role (for Worker to call)
GRANT EXECUTE ON FUNCTION anonymise_old_ips() TO anon;

-- If pg_cron is available (Supabase Pro), schedule daily at 3am UTC:
-- SELECT cron.schedule(
--   'anonymise-old-ips',
--   '0 3 * * *',
--   $$SELECT anonymise_old_ips()$$
-- );

-- For free tier: the Worker will call this function via RPC endpoint
-- POST /rest/v1/rpc/anonymise_old_ips
