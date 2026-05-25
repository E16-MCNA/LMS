import { Queryable } from "../db";
import { generateId } from "../ids";

export const auditRepository = {
  async log(db: Queryable, userId: string, action: string, target: string, detail: string) {
    await db.query(
      "INSERT INTO audit_logs (id, user_id, action, target, detail, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [generateId("audit"), userId, action, target, detail, new Date().toISOString()]
    );
  },

  async listRecent(db: Queryable, limit = 100) {
    return (await db.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1", [limit])).rows;
  }
};
