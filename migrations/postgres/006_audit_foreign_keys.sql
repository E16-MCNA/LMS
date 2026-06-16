DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_user_id_fkey') THEN
    ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advisor_notes_student_id_fkey') THEN
    ALTER TABLE advisor_notes ADD CONSTRAINT advisor_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advisor_notes_advisor_id_fkey') THEN
    ALTER TABLE advisor_notes ADD CONSTRAINT advisor_notes_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES users(id) NOT VALID;
  END IF;
END $$;
