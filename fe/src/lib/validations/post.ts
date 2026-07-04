import { z } from "zod";

export const mediaSchema = z.object({
  id: z.string(),
  type: z.enum(["image", "video"]),
  url: z.string().url(),
  publicId: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  bytes: z.number().optional(),
  format: z.string().optional(),
});

export const createPostSchema = z.object({
  content: z.string().max(280, "Post cannot exceed 280 characters").optional(),
  mediaBase64: z.array(z.string()).optional(),
  media: z.array(mediaSchema).optional(), // For backwards compatibility or direct URL pass
}).refine(data => {
  return (data.content && data.content.trim().length > 0) || 
         (data.mediaBase64 && data.mediaBase64.length > 0) || 
         (data.media && data.media.length > 0);
}, {
  message: "Post must contain either text or media",
  path: ["content"]
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type MediaInput = z.infer<typeof mediaSchema>;
