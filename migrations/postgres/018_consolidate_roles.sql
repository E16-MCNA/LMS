-- 018_consolidate_roles.sql
-- 1. Drop existing check constraint on users role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Safely migrate user data to new roles
UPDATE users SET role = 'admin' WHERE role = 'sale';
UPDATE users SET role = 'admin' WHERE role = 'finance';
UPDATE users SET role = 'teacher' WHERE role = 'advisor';

-- Also handle any legacy roles to be safe
UPDATE users SET role = 'admin' WHERE role IN ('le_tan', 'ke_toan', 'academic_admin', 'academic');

-- 3. Add final strict constraint with the consolidated roles only
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (
  'manager', 'super_admin', 'admin', 'teacher', 'student', 'parent'
));
