-- Migration 026: Add lesson_id and type to assignments table
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('lesson', 'chapter', 'midterm', 'final'));
