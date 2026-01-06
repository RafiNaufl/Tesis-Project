import { z } from "zod";

export const NotificationTypeSchema = z.enum(["info", "success", "warning", "error"]);

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  message: z.string(),
  type: NotificationTypeSchema,
  read: z.boolean(),
  createdAt: z.coerce.date(),
});

export type Notification = z.infer<typeof NotificationSchema>;

export const NotificationListResponseSchema = z.object({
  items: z.array(NotificationSchema),
  unreadCount: z.number().int().nonnegative().optional(),
});

export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;
