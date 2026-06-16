import { Assignment, Submission } from "../../types";
import { Queryable } from "../db";
import { generateId } from "../ids";
import { notifyStudent } from "../notify";

export const assignmentsRepository = {
  async create(db: Queryable, input: Omit<Assignment, "id">) {
    const assignment = { ...input, id: generateId("assign") };
    await db.query(
      "INSERT INTO assignments (id, course_id, title, description, deadline, max_score, attachment_url, lesson_id, type, session_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        assignment.id,
        assignment.courseId,
        assignment.title,
        assignment.description,
        assignment.deadline,
        assignment.maxScore,
        assignment.attachmentUrl || null,
        assignment.lessonId || null,
        assignment.type || null,
        assignment.sessionId || null
      ]
    );
    return assignment;
  },

  async submit(db: Queryable, studentId: string, assignmentId: string, content: string, attachmentUrl?: string) {
    const assignment = (await db.query("SELECT course_id, deadline FROM assignments WHERE id = $1", [assignmentId])).rows[0];
    if (!assignment) return { error: "Assignment not found.", status: 404 };

    // Enforce deadline check
    if (assignment.deadline) {
      const deadlineDate = new Date(assignment.deadline);
      if (new Date() > deadlineDate) {
        return { error: "Không thể nộp hoặc chỉnh sửa bài tập tự luận do đã quá hạn nộp bài (deadline).", status: 400 };
      }
    }

    const enrollment = (await db.query(
      "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
      [studentId, assignment.course_id]
    )).rows[0];
    if (!enrollment) return { error: "Active enrollment required to submit this assignment.", status: 403 };

    const existing = (await db.query(
      "SELECT id FROM submissions WHERE student_id = $1 AND assignment_id = $2",
      [studentId, assignmentId]
    )).rows[0];

    if (existing) {
      const submittedAt = new Date().toISOString();
      const updated = (await db.query(
        "UPDATE submissions SET content = $1, submitted_at = $2, attachment_url = COALESCE($4, attachment_url) WHERE id = $3 RETURNING attachment_url",
        [content, submittedAt, existing.id, attachmentUrl || null]
      )).rows[0];
      return { row: { id: existing.id, assignmentId, studentId, content, submittedAt, attachmentUrl: updated?.attachment_url || undefined } };
    } else {
      const submission: Submission = { id: generateId("sub"), assignmentId, studentId, content, submittedAt: new Date().toISOString(), attachmentUrl };
      await db.query(
        "INSERT INTO submissions (id, assignment_id, student_id, content, submitted_at, attachment_url) VALUES ($1,$2,$3,$4,$5,$6)",
        [submission.id, assignmentId, studentId, content, submission.submittedAt, attachmentUrl || null]
      );
      return { row: submission };
    }
  },

  async findSubmissionForGrading(db: Queryable, submissionId: string) {
    return (await db.query("SELECT s.*, a.max_score, c.teacher_id FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id WHERE s.id = $1", [submissionId])).rows[0] || null;
  },

  async grade(db: Queryable, submissionId: string, score: number, feedback: string) {
    await db.query("UPDATE submissions SET score = $1, feedback = $2, graded_at = $3 WHERE id = $4", [score, feedback, new Date().toISOString(), submissionId]);
    const submission = (await db.query(
      `SELECT s.student_id, a.title, a.max_score
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       WHERE s.id = $1`,
      [submissionId]
    )).rows[0];
    if (submission) {
      const feedbackText = feedback?.trim() ? ` Nhận xét: ${feedback.trim()}` : "";
      await notifyStudent(
        db,
        submission.student_id,
        `Bài tự luận "${submission.title}" đã được chấm: ${score}/${submission.max_score}.${feedbackText}`,
        { relatedEntityType: "submission", relatedEntityId: submissionId }
      );
    }
    return { id: submissionId, score, feedback };
  },

  async update(db: Queryable, id: string, input: Partial<Omit<Assignment, "id" | "courseId">>) {
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, val] of Object.entries(input)) {
      let dbCol = "";
      if (key === "title") dbCol = "title";
      else if (key === "description") dbCol = "description";
      else if (key === "deadline") dbCol = "deadline";
      else if (key === "maxScore") dbCol = "max_score";
      else if (key === "attachmentUrl") dbCol = "attachment_url";
      else if (key === "lessonId") dbCol = "lesson_id";
      else if (key === "sessionId") dbCol = "session_id";
      else if (key === "type") dbCol = "type";

      if (dbCol) {
        sets.push(`${dbCol} = $${paramIndex++}`);
        values.push(val === undefined ? null : val);
      }
    }

    if (sets.length > 0) {
      values.push(id);
      await db.query(`UPDATE assignments SET ${sets.join(", ")} WHERE id = $${paramIndex}`, values);
    }

    const row = (await db.query("SELECT * FROM assignments WHERE id = $1", [id])).rows[0];
    return row ? {
      id: row.id,
      courseId: row.course_id,
      sessionId: row.session_id || undefined,
      title: row.title,
      description: row.description,
      deadline: row.deadline,
      maxScore: Number(row.max_score),
      attachmentUrl: row.attachment_url || undefined,
      lessonId: row.lesson_id || undefined,
      type: row.type || undefined
    } : null;
  },

  async delete(db: Queryable, id: string) {
    await db.query("DELETE FROM assignments WHERE id = $1", [id]);
    return { id };
  }
};
