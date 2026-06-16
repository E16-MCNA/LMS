-- Migration 023: Fix advisor_assignments semester_id foreign key constraint to use ON DELETE SET NULL
ALTER TABLE advisor_assignments DROP CONSTRAINT IF EXISTS advisor_assignments_semester_id_fkey;

ALTER TABLE advisor_assignments 
  ADD CONSTRAINT advisor_assignments_semester_id_fkey 
  FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE SET NULL;
