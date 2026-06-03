import { Question, Quiz } from "../../types";
import { Queryable } from "../db";
import { generateId } from "../ids";
import { questionFromRow, quizFromRow } from "../mappers";
import { notifyStudent } from "../notify";

export const quizzesRepository = {
  async create(db: Queryable, input: Omit<Quiz, "id">) {
    const quiz = { ...input, id: generateId("quiz") };
    await db.query(
      "INSERT INTO quizzes (id, course_id, lesson_id, title, passing_score, time_limit, max_attempts, deadline) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [quiz.id, quiz.courseId, quiz.lessonId || null, quiz.title, quiz.passingScore, quiz.timeLimit, quiz.maxAttempts, quiz.deadline || null]
    );
    return quiz;
  },

  async addQuestion(db: Queryable, input: Omit<Question, "id">) {
    const question = { ...input, id: generateId("question"), createdAt: input.createdAt || new Date().toISOString() };
    await db.query(
      "INSERT INTO questions (id, quiz_id, text, type, options_json, correct_answer, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [question.id, question.quizId, question.text, question.type, JSON.stringify(question.options || []), question.correctAnswer, question.createdAt]
    );
    return question;
  },

  async updateQuestion(db: Queryable, questionId: string, input: { text: string; type: "single" | "multiple" | "text"; options: string[]; correctAnswer: string }) {
    await db.query(
      "UPDATE questions SET text = $1, type = $2, options_json = $3, correct_answer = $4 WHERE id = $5",
      [input.text, input.type, JSON.stringify(input.options || []), input.correctAnswer, questionId]
    );
    return { id: questionId, ...input };
  },

  async deleteQuestion(db: Queryable, questionId: string) {
    await db.query("DELETE FROM questions WHERE id = $1", [questionId]);
    return { id: questionId };
  },

  async findById(db: Queryable, quizId: string) {
    const row = (await db.query("SELECT * FROM quizzes WHERE id = $1", [quizId])).rows[0];
    return row ? quizFromRow(row) : null;
  },

  async listQuestions(db: Queryable, quizId: string) {
    return (await db.query("SELECT * FROM questions WHERE quiz_id = $1", [quizId])).rows.map(questionFromRow);
  },

  async submitAttempt(db: Queryable, quizId: string, studentId: string, answers: Record<string, string>, startedAt?: string) {
    const quiz = await this.findById(db, quizId);
    if (!quiz) return null;

    const enrollment = (await db.query(
      "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
      [studentId, quiz.courseId]
    )).rows[0];
    if (!enrollment) return { error: "Active enrollment required to submit this quiz.", status: 403 };

    // Enforce maxAttempts check
    if (quiz.maxAttempts && quiz.maxAttempts > 0) {
      const attemptsCountRes = await db.query(
        "SELECT COUNT(*) AS count FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2",
        [quizId, studentId]
      );
      const attemptCount = Number(attemptsCountRes.rows[0].count);
      if (attemptCount >= quiz.maxAttempts) {
        return { error: `Đã vượt quá số lượt làm bài tối đa cho phép (${quiz.maxAttempts} lượt).`, status: 403 };
      }
    }

    // Enforce timeLimit check (timeLimit is in minutes)
    if (quiz.timeLimit && quiz.timeLimit > 0 && startedAt) {
      const startTime = new Date(startedAt).getTime();
      const endTime = Date.now();
      const elapsedMinutes = (endTime - startTime) / (1000 * 60);
      // Give 0.2 minutes (12 seconds) grace period for network delays
      if (elapsedMinutes > quiz.timeLimit + 0.2) {
        return { error: `Thời gian làm bài thi trắc nghiệm đã vượt quá giới hạn cho phép (${quiz.timeLimit} phút).`, status: 403 };
      }
    }

    // Enforce deadline check if set
    if (quiz.deadline) {
      const deadlineDate = new Date(quiz.deadline);
      if (new Date() > deadlineDate) {
        return { error: "Không thể nộp bài trắc nghiệm do đã quá hạn nộp bài (deadline).", status: 400 };
      }
    }

    const questions = await this.listQuestions(db, quizId);
    let correctCount = 0;
    for (const question of questions) {
      const studentAnswer = answers[question.id] || "";
      if (question.type === "text" && question.correctAnswer.toLowerCase().split(",").map(key => key.trim()).some(key => studentAnswer.toLowerCase().includes(key))) {
        correctCount++;
      } else if (question.type === "multiple") {
        const sortedStudent = studentAnswer.split(",").map(x => x.trim()).filter(Boolean).sort().join(",");
        const sortedCorrect = question.correctAnswer.split(",").map(x => x.trim()).filter(Boolean).sort().join(",");
        if (sortedStudent === sortedCorrect) correctCount++;
      } else if (question.type === "single" && studentAnswer === question.correctAnswer) {
        correctCount++;
      }
    }
    const score = Math.round((correctCount / (questions.length || 1)) * 100);
    const passed = score >= quiz.passingScore;
    const attempt = { id: generateId("attempt"), quizId, studentId, answers, score, passed, startedAt: startedAt || new Date().toISOString(), submittedAt: new Date().toISOString() };
    await db.query(
      "INSERT INTO quiz_attempts (id,quiz_id,student_id,answers_json,score,passed,started_at,submitted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [attempt.id, quizId, studentId, JSON.stringify(answers), score, passed ? 1 : 0, attempt.startedAt, attempt.submittedAt]
    );
    await notifyStudent(
      db,
      studentId,
      `Quiz "${quiz.title}" scored ${score}%${passed ? " — passed" : ""}.`,
      { relatedEntityType: "quiz", relatedEntityId: quizId }
    );
    return { row: { ...attempt, correctAnswers: correctCount, total: questions.length } };
  }
};
