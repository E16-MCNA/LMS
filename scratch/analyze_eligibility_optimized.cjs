const dotenv = require('dotenv');
const pg = require('pg');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("supabase.co") ? { rejectUnauthorized: false } : undefined
});

async function main() {
  console.log("Running optimized eligibility check...");

  const query = `
    WITH lesson_counts AS (
      SELECT course_id, COUNT(*) as total_lessons
      FROM lessons
      GROUP BY course_id
    ),
    completed_lessons AS (
      SELECT lp.enrollment_id, COUNT(*) as completed_count
      FROM lesson_progress lp
      WHERE lp.completed = true
      GROUP BY lp.enrollment_id
    ),
    quiz_counts AS (
      SELECT course_id, COUNT(*) as total_quizzes
      FROM quizzes
      GROUP BY course_id
    ),
    passed_quizzes AS (
      SELECT qa.student_id, q.course_id, COUNT(DISTINCT q.id) as passed_quizzes_count
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.passed = true
      GROUP BY qa.student_id, q.course_id
    )
    SELECT 
      u.id as student_id,
      u.name as student_name,
      u.email as student_email,
      co.title as course_title,
      e.id as enrollment_id,
      e.status as enroll_status,
      COALESCE(cl.completed_count, 0) || '/' || COALESCE(lc.total_lessons, 0) as lessons_completed,
      COALESCE(pq.passed_quizzes_count, 0) || '/' || COALESCE(qc.total_quizzes, 0) as quizzes_passed
    FROM enrollments e
    JOIN users u ON e.student_id = u.id
    JOIN courses co ON e.course_id = co.id
    LEFT JOIN lesson_counts lc ON lc.course_id = e.course_id
    LEFT JOIN completed_lessons cl ON cl.enrollment_id = e.id
    LEFT JOIN quiz_counts qc ON qc.course_id = e.course_id
    LEFT JOIN passed_quizzes pq ON pq.student_id = e.student_id AND pq.course_id = e.course_id
    WHERE 
      -- Completed all lessons
      COALESCE(cl.completed_count, 0) = COALESCE(lc.total_lessons, 0)
      -- Completed all quizzes (if course has quizzes)
      AND (COALESCE(qc.total_quizzes, 0) = 0 OR COALESCE(pq.passed_quizzes_count, 0) = COALESCE(qc.total_quizzes, 0))
  `;

  const res = await pool.query(query);
  console.log("\n--- OPTIMIZED ELIGIBLE STUDENTS ---");
  console.table(res.rows);
}

main().catch(console.error).finally(() => pool.end());
