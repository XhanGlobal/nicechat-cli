import { z } from "zod";

/** GET /api/nicechat/contacts?status= */
export const contactListQuerySchema = z.object({
  status: z.enum(["accepted", "pending", "blocked"]).default("accepted"),
});

/** POST /api/nicechat/contacts */
export const sendContactRequestSchema = z.object({
  addresseeId: z
    .string({ message: "addresseeId 必填。" })
    .min(1, { message: "addresseeId 必填。" }),
});

/** PATCH /api/nicechat/contacts/[id] */
export const patchContactSchema = z.object({
  status: z.enum(["accepted", "blocked"], {
    message: "status 必须是 accepted 或 blocked。",
  }),
});

/** POST /api/nicechat/conversations */
export const findOrCreateConversationSchema = z.object({
  userId: z
    .string({ message: "userId 必填。" })
    .min(1, { message: "userId 必填。" }),
});

/** PATCH /api/nicechat/conversations/[id] */
export const patchConversationParticipantSchema = z.object({
  is_muted: z.boolean({ message: "is_muted 必须是布尔值。" }),
});

export const messageTypeSchema = z.enum(["text", "image", "file", "system"]);

const sendMessageFieldsSchema = z
  .object({
    content: z.string().optional(),
    type: messageTypeSchema.optional(),
    mediaUrl: z.string().optional(),
    mediaName: z.string().optional(),
    mediaSize: z.number().optional(),
    replyToId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const t = data.type ?? "text";
    if (t === "text" && !(data.content ?? "").trim()) {
      ctx.addIssue({
        code: "custom",
        message: "文本消息的 content 不能为空。",
        path: ["content"],
      });
    }
  });

/** POST /api/nicechat/conversations/[id]/messages */
export const sendMessageBodySchema = sendMessageFieldsSchema;

export const DEFAULT_MESSAGE_PAGE_LIMIT = 50;
export const MAX_MESSAGE_PAGE_LIMIT = 100;

/** GET /api/nicechat/conversations/[id]/messages — query string */
export const messageListQuerySchema = z.object({
  before: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((s) => {
      const n = parseInt(s ?? String(DEFAULT_MESSAGE_PAGE_LIMIT), 10);
      const v = Number.isNaN(n) ? DEFAULT_MESSAGE_PAGE_LIMIT : n;
      return Math.min(Math.max(v, 1), MAX_MESSAGE_PAGE_LIMIT);
    }),
});

/** POST /api/nicechat/presence — optional body */
export const presencePostBodySchema = z.object({
  status: z.enum(["online", "away", "offline"]).optional(),
});

/** GET /api/nicechat/users/search */
export const userSearchQuerySchema = z.object({
  q: z.string().trim().min(1, { message: "搜索关键词 q 不能为空。" }),
});
