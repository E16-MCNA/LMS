import { Course, Lesson } from "../../types";
import { Queryable } from "../db";
import { generateId } from "../ids";
import { courseFromRow } from "../mappers";

export const coursesRepository = {
  async list(db: Queryable) {
    return (await db.query("SELECT * FROM courses ORDER BY created_at DESC")).rows.map(courseFromRow);
  },

  async listByTeacher(db: Queryable, teacherId: string) {
    return (await db.query("SELECT * FROM courses WHERE teacher_id = $1 ORDER BY created_at DESC", [teacherId])).rows.map(courseFromRow);
  },

  async findById(db: Queryable, id: string) {
    const row = (await db.query("SELECT * FROM courses WHERE id = $1", [id])).rows[0];
    return row ? courseFromRow(row) : null;
  },

  async create(db: Queryable, input: Omit<Course, "id" | "createdAt">) {
    const course: Course = { ...input, id: generateId("course"), createdAt: new Date().toISOString() };
    await db.query(
      "INSERT INTO courses (id,title,description,teacher_id,status,category,thumbnail,price,level,tags_json,rejection_reason,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      [course.id, course.title, course.description, course.teacherId, course.status, course.category, course.thumbnail || null, course.price || 0, course.level || null, JSON.stringify(course.tags || []), course.rejectionReason || null, course.createdAt]
    );
    return course;
  },

  async setStatus(db: Queryable, id: string, status: Course["status"], rejectionReason?: string) {
    const row = (await db.query("UPDATE courses SET status = $1, rejection_reason = $2 WHERE id = $3 RETURNING *", [status, rejectionReason || null, id])).rows[0];
    return row ? courseFromRow(row) : null;
  },

  async addLesson(db: Queryable, input: Omit<Lesson, "id">) {
    const lesson = { ...input, id: generateId("lesson") };
    await db.query(
      "INSERT INTO lessons (id, course_id, title, content, video_url, lesson_order, duration) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [lesson.id, lesson.courseId, lesson.title, lesson.content, lesson.videoUrl || null, lesson.order, lesson.duration]
    );
    return lesson;
  },

  async teacherOwnsCourse(db: Queryable, teacherId: string, courseId: string) {
    return Boolean((await db.query("SELECT id FROM courses WHERE id = $1 AND teacher_id = $2", [courseId, teacherId])).rows[0]);
  }
};
