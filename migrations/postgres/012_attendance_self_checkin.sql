-- 012_attendance_self_checkin.sql
-- Add nullable code and expires_at columns to attendance_sessions table
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS expires_at TEXT;
