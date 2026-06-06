-- 020_enrollment_pending_status.sql
-- Add manager approval state for course enrollments before class placement.

ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_status_check;
ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_status_check
  CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'pending_payment'));
