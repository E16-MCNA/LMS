ALTER TABLE semesters ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE semesters
SET is_current = TRUE
WHERE id = 'sem_spring25'
  AND NOT EXISTS (SELECT 1 FROM semesters WHERE is_current = TRUE);
