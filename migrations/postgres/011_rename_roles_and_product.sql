-- 011_rename_roles_and_product.sql
-- 1. Drop existing check constraint on users role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Add temporary check constraint that accepts all old and new roles to allow safe updates
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (
  'admin', 'super_admin', 'teacher', 'student', 'le_tan', 'academic_admin', 'finance', 'advisor', 'parent',
  'manager', 'sale'
));

-- 3. Safely migrate user data to new roles
UPDATE users SET role = 'manager' WHERE role = 'admin';
UPDATE users SET role = 'admin' WHERE role = 'academic_admin';
UPDATE users SET role = 'sale' WHERE role = 'le_tan';

-- 4. Drop the temporary constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 5. Add final strict constraint with the new roles only
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (
  'manager', 'super_admin', 'admin', 'teacher', 'student', 'sale', 'finance', 'advisor', 'parent'
));
