-- 017_fix_system_events_payload.sql
-- Ensure system_events has 'payload' (jsonb) column and drop 'payload_json' if it exists.

DO $$
BEGIN
  -- 1. If payload_json exists, and payload does not exist: rename it to payload
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'system_events' AND column_name = 'payload_json'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'system_events' AND column_name = 'payload'
  ) THEN
    ALTER TABLE system_events RENAME COLUMN payload_json TO payload;
  END IF;

  -- 2. If payload_json exists, and payload ALSO exists: drop payload_json
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'system_events' AND column_name = 'payload_json'
  ) AND EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'system_events' AND column_name = 'payload'
  ) THEN
    ALTER TABLE system_events DROP COLUMN payload_json;
  END IF;

  -- 3. If payload does not exist: create it as jsonb
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'system_events' AND column_name = 'payload'
  ) THEN
    ALTER TABLE system_events ADD COLUMN payload jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;

  -- 4. Ensure payload is of type jsonb
  ALTER TABLE system_events ALTER COLUMN payload SET DATA TYPE jsonb USING payload::jsonb;
  ALTER TABLE system_events ALTER COLUMN payload SET DEFAULT '{}'::jsonb;
END
$$;
