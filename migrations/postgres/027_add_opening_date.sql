-- Migration 027: Add opening_date, number_of_lessons, class_name fields
ALTER TABLE courses ADD COLUMN IF NOT EXISTS opening_date TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS number_of_lessons INTEGER;

ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS opening_date TEXT;

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS class_name TEXT;
