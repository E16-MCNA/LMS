const dotenv = require('dotenv');
const pg = require('pg');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("supabase.co") ? { rejectUnauthorized: false } : undefined
});

async function main() {
  console.log("Querying certificates table...");

  const certsRes = await pool.query(`
    SELECT c.id, c.certificate_code, c.issued_at, u.id as user_id, u.name, u.email, co.title as course_title
    FROM certificates c
    JOIN users u ON c.student_id = u.id
    JOIN courses co ON c.course_id = co.id
  `);
  
  console.log("Certificates issued:");
  console.table(certsRes.rows);

  console.log("Querying completed enrollments...");
  const completedRes = await pool.query(`
    SELECT e.id as enrollment_id, e.status, u.id as student_id, u.name, u.email, co.title as course_title
    FROM enrollments e
    JOIN users u ON e.student_id = u.id
    JOIN courses co ON e.course_id = co.id
    WHERE e.status = 'completed'
  `);
  console.log("Completed enrollments:");
  console.table(completedRes.rows);
}

main().catch(console.error).finally(() => pool.end());
