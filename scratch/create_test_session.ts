// scratch/create_test_session.ts
import { pool } from "../src/server/db";
import { generateId } from "../src/server/ids";

async function run() {
  console.log("Connecting to PostgreSQL...");
  const client = await pool.connect();
  try {
    console.log("Clearing existing test session & notifications...");
    await client.query("DELETE FROM notifications WHERE related_entity_id = $1", ["ats_test_checkin"]);
    await client.query("DELETE FROM attendance_sessions WHERE id = $1", ["ats_test_checkin"]);

    // Expiration time set to 2:30 PM (14:30:00+07:00) so they have plenty of time starting at 2:15 PM!
    const expiresAt = "2026-06-02T14:30:00+07:00";
    const session = {
      id: "ats_test_checkin",
      courseId: "course_fsweb",
      semesterId: "sem_spring25",
      teacherId: "user_teacher",
      date: "2026-06-02 (14:15 - 15:45)",
      topic: "Buổi học kiểm thử hệ thống điểm danh tự động",
      code: "TESTER",
      expiresAt: expiresAt
    };

    console.log("Inserting new test attendance session starting at 2:15 PM...");
    await client.query(
      `INSERT INTO attendance_sessions (id, course_id, semester_id, teacher_id, session_date, date, topic, code, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [session.id, session.courseId, session.semesterId, session.teacherId, "2026-06-02", session.date, session.topic, session.code, session.expiresAt]
    );

    console.log("Fetching enrolled active students...");
    const enrolls = await client.query(
      "SELECT student_id FROM enrollments WHERE course_id = $1 AND status = 'active'",
      [session.courseId]
    );
    const studentIds = enrolls.rows.map(row => row.student_id);
    console.log(`Found ${studentIds.length} active students in course:`, studentIds);

    console.log("Sending check-in notifications to all active students...");
    const message = `[Điểm danh trực tuyến] Môn học "Full-Stack Web Development Bootcamp" đang tiến hành điểm danh trực tuyến lúc 2h15 chiều nay. Hãy click vào đây và nhập mã TESTER để xác nhận có mặt.`;

    for (const studentId of studentIds) {
      const notiId = "noti_checkin_" + studentId + "_" + Date.now().toString().slice(-4);
      await client.query(
        `INSERT INTO notifications (id, user_id, type, message, is_read, created_at, related_entity_type, related_entity_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [notiId, studentId, "attendance_link", message, false, new Date().toISOString(), "attendance_session", session.id]
      );
    }

    console.log("✅ Seeded test attendance session successfully!");
  } catch (error) {
    console.error("Error seeding session:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
