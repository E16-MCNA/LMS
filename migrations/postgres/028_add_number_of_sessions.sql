-- Add number_of_sessions column to course_sections table
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS number_of_sessions INTEGER;

UPDATE course_sections cs
SET number_of_sessions = COALESCE(c.number_of_lessons, lesson_counts.lesson_count, 1)
FROM courses c
LEFT JOIN (
  SELECT course_id, COUNT(*)::integer AS lesson_count
  FROM lessons
  GROUP BY course_id
) lesson_counts ON lesson_counts.course_id = c.id
WHERE cs.course_id = c.id
  AND cs.number_of_sessions IS NULL;
