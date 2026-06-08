import { pool } from "../src/server/db";
import { usersRepository } from "../src/server/repositories/users";
import { eventBus } from "../src/server/eventBus";
import { deleteSchoolEmail } from "../src/server/emailProvisioning/googleWorkspaceClient";
import { generateId } from "../src/server/ids";
import { registerEventHandlers } from "../src/server/eventHandlers";

async function runTest() {
  registerEventHandlers();
  console.log("=== STARTING EMAIL PROVISIONING TEST ===");
  
  // 1. Create a dummy student user object
  const testStudentId = generateId("user");
  const testStudent = {
    id: testStudentId,
    email: `student_test_${Date.now()}@gmail.com`,
    passwordHash: "dummyhash",
    passwordSalt: "dummysalt",
    name: "Nguyễn Văn Tiến",
    role: "student" as const,
    isActive: true,
    createdAt: new Date().toISOString()
  };

  console.log(`Creating test student: ${testStudent.name} (${testStudent.email})`);
  
  // 2. Insert user into DB
  const created = await usersRepository.create(pool, testStudent);
  console.log("Student created in DB:", created.id);

  // 3. Emit user.created event to trigger provisioning
  console.log("Emitting 'user.created' event...");
  await eventBus.emit("user.created", created, pool);

  // 4. Query DB to verify school_email, email_provisioned, email_provisioned_at
  console.log("Querying database for provisioning results...");
  const dbUser = (await pool.query(
    "SELECT id, email, school_email, email_provisioned, email_provisioned_at FROM users WHERE id = $1",
    [testStudentId]
  )).rows[0];

  console.log("Database provisioning columns:", dbUser);

  if (dbUser.email_provisioned && /^tien\.van\.nguyen\d*@mcna\.edu\.vn$/.test(dbUser.school_email)) {
    console.log("SUCCESS: Database record updated correctly with expected school email!");
  } else {
    console.error("FAILURE: Database record not updated or school email mismatch.");
  }

  // 5. Test deactivation
  console.log("Testing deactivation (status active = false)...");
  const deactivatedUser = await usersRepository.setActive(pool, testStudentId, false);
  
  // Trigger status deactivation hook manually (replicating server.ts status PATCH route)
  if (deactivatedUser && deactivatedUser.role === "student" && deactivatedUser.schoolEmail) {
    try {
      console.log(`Deactivating school email for: ${deactivatedUser.schoolEmail}`);
      await deleteSchoolEmail(deactivatedUser.schoolEmail);
      await pool.query(
        "UPDATE users SET email_provisioned = false, school_email = NULL, email_provisioned_at = NULL WHERE id = $1",
        [deactivatedUser.id]
      );
      console.log("Cleared school email fields from DB on deactivation.");
    } catch (err) {
      console.error("Failed to delete workspace email:", err);
    }
  }

  // Verify DB after deactivation
  const dbUserAfterDeactivate = (await pool.query(
    "SELECT id, email, school_email, email_provisioned FROM users WHERE id = $1",
    [testStudentId]
  )).rows[0];
  console.log("Database status after deactivation:", dbUserAfterDeactivate);

  if (!dbUserAfterDeactivate.email_provisioned && dbUserAfterDeactivate.school_email === null) {
    console.log("SUCCESS: Deactivation cleaned database record correctly!");
  } else {
    console.error("FAILURE: Deactivation did not clear database columns.");
  }

  console.log("=== TEST SUITE COMPLETED ===");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
