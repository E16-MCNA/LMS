import { pool } from "../src/server/db";

async function run() {
  try {
    const res = await pool.query(
      "SELECT id, email, name, role, is_active FROM users WHERE role NOT IN ('student', 'teacher') ORDER BY role"
    );
    console.log("--- DATABASE ADMINISTRATIVE USERS ---");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Error querying users:", err);
  } finally {
    await pool.end();
  }
}

run();
