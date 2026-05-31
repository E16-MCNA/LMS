import { pool } from "../src/server/db";
import { usersRepository } from "../src/server/repositories/users";

async function run() {
  try {
    console.log("Running normalizeSystemUsers...");
    await usersRepository.normalizeSystemUsers(pool);
    console.log("System users normalized successfully!");

    const res = await pool.query(
      "SELECT id, email, name, role, is_active FROM users WHERE role NOT IN ('student', 'teacher') ORDER BY role"
    );
    console.log("--- UPDATED DATABASE ADMINISTRATIVE USERS ---");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Error executing fix:", err);
  } finally {
    await pool.end();
  }
}

run();
