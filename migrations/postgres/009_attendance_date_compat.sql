-- 009_attendance_date_compat.sql
-- Keep legacy session_date schemas compatible with repositories that use date.

ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS date TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name='attendance_sessions' AND column_name='session_date'
  ) THEN
    EXECUTE 'UPDATE attendance_sessions SET date = session_date WHERE date IS NULL AND session_date IS NOT NULL';
  END IF;
END $$;
