import { z } from "zod";

export const createCommentSchema = z.object({
  postId: z.string(),
  content: z.string().min(1, "Comment cannot be empty").max(500, "Comment cannot exceed 500 characters"),
  parentCommentId: z.string().optional().nullable(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
