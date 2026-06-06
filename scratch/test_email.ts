import "dotenv/config";
import { pool } from "../src/server/db";
import { notificationsRepository } from "../src/server/repositories/notifications";

async function main() {
  console.log("Triggering test notification...");
  try {
    // We trigger a notification for the default student user_student
    await notificationsRepository.create(pool, {
      userId: "user_student",
      type: "info",
      message: "Chúc mừng! Đây là email thông báo tự động được kích hoạt thành công từ E16 LMS."
    });
    console.log("Test notification triggered. Waiting for async mail dispatch...");
    // Wait 2 seconds for the async email processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("Finished waiting.");
  } catch (err) {
    console.error("Test trigger failed:", err);
  } finally {
    await pool.end();
  }
}

main();
