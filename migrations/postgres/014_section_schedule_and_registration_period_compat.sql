-- Keep production schemas compatible when course_sections was created with
-- schedule JSONB instead of the newer schedule_json TEXT column.

ALTER TABLE course_sections
  ADD COLUMN IF NOT EXISTS schedule_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE course_sections DROP CONSTRAINT IF EXISTS course_sections_status_check;
ALTER TABLE course_sections
  ADD CONSTRAINT course_sections_status_check
  CHECK (status IN ('pending', 'open', 'closed', 'cancelled'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'course_sections'
      AND column_name = 'schedule'
  ) THEN
    EXECUTE $sql$
      UPDATE course_sections
      SET schedule_json = COALESCE(NULLIF(schedule::text, ''), '[]')
      WHERE schedule_json IS NULL OR schedule_json = '[]'
    $sql$;

    EXECUTE $sql$
      ALTER TABLE course_sections
      ALTER COLUMN schedule SET DEFAULT '[]'::jsonb
    $sql$;
  END IF;
END $$;

-- Ensure the current demo/default registration period used by the UI is open
-- on already-seeded databases, not only on fresh seed.
INSERT INTO registration_periods (id, semester_id, name, start_date, end_date, allowed_years, is_open)
VALUES (
  'rp_spring25',
  'sem_spring25',
  'Đăng ký học kỳ Mùa Xuân 2025',
  '2024-12-01',
  '2026-12-31',
  '{1,2,3,4}',
  true
)
ON CONFLICT (id) DO UPDATE SET
  semester_id = EXCLUDED.semester_id,
  name = EXCLUDED.name,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  allowed_years = EXCLUDED.allowed_years,
  is_open = EXCLUDED.is_open;
