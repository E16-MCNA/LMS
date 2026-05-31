const dotenv = require('dotenv');
const pg = require('pg');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("supabase.co") ? { rejectUnauthorized: false } : undefined
});

async function main() {
  console.log("Checking tables...");

  // Let's get all tables
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema='public'
  `);
  console.log("Tables:", tablesRes.rows.map(r => r.table_name));

  // Check users
  const usersRes = await pool.query("SELECT id, name, email, role FROM users");
  console.log("\n--- USERS ---");
  console.table(usersRes.rows);

  // Check certificates
  const certsRes = await pool.query("SELECT * FROM certificates");
  console.log("\n--- CERTIFICATES ---");
  console.table(certsRes.rows);

  // Check enrollments
  const enrollRes = await pool.query("SELECT id, course_id, student_id, status, completed_at FROM enrollments");
  console.log("\n--- ENROLLMENTS ---");
  console.table(enrollRes.rows);

  // Check lesson progress / completion
  const progressRes = await pool.query("SELECT enrollment_id, count(*) as completed_count FROM lesson_progress WHERE completed = true GROUP BY enrollment_id");
  console.log("\n--- LESSON PROGRESS (Completed) ---");
  console.table(progressRes.rows);

  // Check quizzes
  const quizzesRes = await pool.query("SELECT id, title, course_id, passing_score FROM quizzes");
  console.log("\n--- QUIZZES ---");
  console.table(quizzesRes.rows);

  // Check quiz attempts
  const attemptsRes = await pool.query("SELECT id, quiz_id, student_id, score, passed FROM quiz_attempts");
  console.log("\n--- QUIZ ATTEMPTS ---");
  console.table(attemptsRes.rows);
}

main().catch(console.error).finally(() => pool.end());
