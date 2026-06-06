-- 019_forum_and_attendance_sections.sql
-- Add section_id to forum_posts table
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS section_id TEXT REFERENCES course_sections(id) ON DELETE CASCADE;

-- Add section_id to attendance_sessions table
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS section_id TEXT REFERENCES course_sections(id) ON DELETE CASCADE;
