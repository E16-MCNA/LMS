CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS advisor_notes (
  id TEXT PRIMARY KEY,
  advisor_id TEXT REFERENCES users(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('academic', 'behavioral', 'financial')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_advisor_notes_advisor_id ON advisor_notes (advisor_id);
CREATE INDEX IF NOT EXISTS idx_advisor_notes_student_id ON advisor_notes (student_id);
