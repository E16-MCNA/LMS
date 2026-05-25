import { AcademicWarning } from "../../types";
import { Queryable } from "../db";
import { generateId } from "../ids";
import { academicWarningFromRow } from "../mappers";

export const academicsRepository = {
  async listWarnings(db: Queryable, studentId?: string) {
    const result = studentId
      ? await db.query("SELECT * FROM academic_warnings WHERE student_id = $1 ORDER BY created_at DESC", [studentId])
      : await db.query("SELECT * FROM academic_warnings ORDER BY created_at DESC");
    return result.rows.map(academicWarningFromRow);
  },

  async createWarning(db: Queryable, input: Omit<AcademicWarning, "id" | "createdAt" | "isResolved">) {
    const warning: AcademicWarning = { ...input, id: generateId("warning"), isResolved: false, createdAt: new Date().toISOString() };
    await db.query(
      "INSERT INTO academic_warnings (id, student_id, type, message, is_resolved, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [warning.id, warning.studentId, warning.type, warning.message, 0, warning.createdAt]
    );
    return warning;
  },

  async resolveWarning(db: Queryable, id: string) {
    const row = (await db.query("UPDATE academic_warnings SET is_resolved = true WHERE id = $1 RETURNING *", [id])).rows[0];
    return row ? academicWarningFromRow(row) : null;
  },

  async getAdvisorNotes(db: Queryable, advisorId: string) {
    return (await db.query("SELECT * FROM advisor_notes WHERE advisor_id = $1 ORDER BY created_at DESC", [advisorId])).rows;
  },

  async addAdvisorNote(db: Queryable, advisorId: string, studentId: string, content: string, type: string) {
    const note = { id: generateId("note"), advisorId, studentId, content, type, createdAt: new Date().toISOString() };
    await db.query(
      "INSERT INTO advisor_notes (id, advisor_id, student_id, content, type, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [note.id, advisorId, studentId, content, type, note.createdAt]
    );
    return note;
  }
};
