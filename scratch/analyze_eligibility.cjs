const dotenv = require('dotenv');
const pg = require('pg');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("supabase.co") ? { rejectUnauthorized: false } : undefined
});

async function main() {
  console.log("Analyzing student eligibility...");

  // 1. Get courses with their lessons count and quizzes
  const coursesRes = await pool.query(`
    SELECT c.id as course_id, c.title as course_title,
           (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) as lessons_count,
           (SELECT COUNT(*) FROM quizzes q WHERE q.course_id = c.id) as quizzes_count
    FROM courses c
  `);
  const coursesMap = {};
  for (const row of coursesRes.rows) {
    coursesMap[row.course_id] = {
      title: row.course_title,
      lessons_count: parseInt(row.lessons_count, 10),
      quizzes_count: parseInt(row.quizzes_count, 10)
    };
  }

  // 2. Get enrollments and details
  const enrollmentsRes = await pool.query(`
    SELECT e.id as enrollment_id, e.course_id, e.student_id, e.status as enroll_status,
           u.name as student_name, u.email as student_email
    FROM enrollments e
    JOIN users u ON e.student_id = u.id
  `);

  console.log(`Found ${enrollmentsRes.rows.length} enrollments in total.`);

  const eligibleStudents = [];

  for (const enroll of enrollmentsRes.rows) {
    const course = coursesMap[enroll.course_id];
    if (!course) continue;

    // Count completed lessons for this enrollment
    const completedLessonsRes = await pool.query(`
      SELECT COUNT(*) as completed_count 
      FROM lesson_progress 
      WHERE enrollment_id = $1 AND completed = true
    `, [enroll.enrollment_id]);
    const completedCount = parseInt(completedLessonsRes.rows[0].completed_count, 10);

    // Check if student passed the quizzes for this course
    // Get quizzes for this course
    const quizzesRes = await pool.query(`
      SELECT id, title, passing_score FROM quizzes WHERE course_id = $1
    `, [enroll.course_id]);

    let allQuizzesPassed = true;
    const quizStatus = [];

    for (const quiz of quizzesRes.rows) {
      // Find if there is a passed attempt by this student
      const attemptRes = await pool.query(`
        SELECT score, passed 
        FROM quiz_attempts 
        WHERE quiz_id = $1 AND student_id = $2 AND passed = true
        ORDER BY score DESC LIMIT 1
      `, [quiz.id, enroll.student_id]);

      if (attemptRes.rows.length > 0) {
        quizStatus.push({
          quiz_title: quiz.title,
          passed: true,
          score: attemptRes.rows[0].score
        });
      } else {
        allQuizzesPassed = false;
        quizStatus.push({
          quiz_title: quiz.title,
          passed: false
        });
      }
    }

    const isLessonsCompleted = completedCount === course.lessons_count;
    const hasQuizzes = course.quizzes_count > 0;
    const isQuizEligible = !hasQuizzes || allQuizzesPassed;

    if (isLessonsCompleted && isQuizEligible) {
      eligibleStudents.push({
        student_id: enroll.student_id,
        student_name: enroll.student_name,
        student_email: enroll.student_email,
        course_title: course.title,
        enrollment_id: enroll.enrollment_id,
        lessons_completed: `${completedCount}/${course.lessons_count}`,
        quizzes_passed: allQuizzesPassed ? "Yes" : "No/No Quizzes",
        enroll_status: enroll.enroll_status
      });
    }
  }

  console.log("\n--- ELIGIBLE STUDENTS FOR CERTIFICATE ---");
  if (eligibleStudents.length === 0) {
    console.log("No eligible students found based on database query.");
  } else {
    console.table(eligibleStudents);
  }
}

main().catch(console.error).finally(() => pool.end());
