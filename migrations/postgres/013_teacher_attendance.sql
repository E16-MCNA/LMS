-- 013_teacher_attendance.sql
-- Create table to track teacher self-attendance check-in status for scheduled classes

CREATE TABLE IF NOT EXISTS teacher_attendance (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
  class_date TEXT NOT NULL,          -- "YYYY-MM-DD"
  slot_time TEXT NOT NULL,           -- e.g., "08:00 - 10:00"
  status TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent')),
  checked_in_at TEXT NOT NULL        -- ISO timestamp
);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher ON teacher_attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_section ON teacher_attendance(section_id);
