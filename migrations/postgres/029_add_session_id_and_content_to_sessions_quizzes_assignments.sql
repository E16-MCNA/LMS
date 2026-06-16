-- Migration 029: Add session_id, video_url and content columns
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES attendance_sessions(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES attendance_sessions(id) ON DELETE SET NULL;
