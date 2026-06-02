// scratch/check_notifications.ts
import { pool } from "../src/server/db";

async function run() {
  const client = await pool.connect();
  try {
    const userRes = await client.query("SELECT id, email, role, name FROM users WHERE role = 'student' LIMIT 15");
    console.log("All student user records:", userRes.rows);

    const studentId = "user_student";
    const notis = await client.query(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5",
      [studentId]
    );
    console.log(`Notifications for ${studentId}:`, notis.rows);

    const enroll = await client.query(
      "SELECT * FROM enrollments WHERE student_id = $1 AND status = 'active'",
      [studentId]
    );
    console.log(`Enrollments for ${studentId}:`, enroll.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
