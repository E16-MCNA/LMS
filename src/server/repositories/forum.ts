import { ForumPost, ForumReply } from "../../types";
import { Queryable } from "../db";
import { generateId } from "../ids";

export const forumRepository = {
  async createPost(db: Queryable, input: { courseId: string; sectionId?: string; authorId: string; title: string; content: string }): Promise<ForumPost> {
    const post: ForumPost = {
      id: generateId("post"),
      courseId: input.courseId,
      sectionId: input.sectionId,
      authorId: input.authorId,
      title: input.title,
      content: input.content,
      replies: [],
      createdAt: new Date().toISOString()
    };
    await db.query(
      `INSERT INTO forum_posts (id, course_id, section_id, author_id, title, content, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [post.id, post.courseId, post.sectionId || null, post.authorId, post.title, post.content, post.createdAt]
    );
    return post;
  },

  async createReply(db: Queryable, input: { postId: string; authorId: string; content: string }): Promise<ForumReply> {
    const reply: ForumReply = {
      id: generateId("reply"),
      postId: input.postId,
      authorId: input.authorId,
      content: input.content,
      createdAt: new Date().toISOString()
    };
    await db.query(
      `INSERT INTO forum_replies (id, post_id, author_id, content, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [reply.id, reply.postId, reply.authorId, reply.content, reply.createdAt]
    );
    return reply;
  }
};
