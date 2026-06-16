-- Migration 026: Add lesson_id and type to assignments table
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('lesson', 'chapter', 'midterm', 'final'));

UPDATE assignments a
SET lesson_id = first_lesson.id,
    type = COALESCE(a.type, 'lesson')
FROM (
  SELECT DISTINCT ON (course_id) id, course_id
  FROM lessons
  ORDER BY course_id, lesson_order ASC
) first_lesson
WHERE a.course_id = first_lesson.course_id
  AND a.lesson_id IS NULL;

UPDATE quizzes q
SET lesson_id = first_lesson.id
FROM (
  SELECT DISTINCT ON (course_id) id, course_id
  FROM lessons
  ORDER BY course_id, lesson_order ASC
) first_lesson
WHERE q.course_id = first_lesson.course_id
  AND q.lesson_id IS NULL;
