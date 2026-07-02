import { z } from 'zod'

export const alertListQuerySchema = z.object({
  status: z.enum(['open', 'ordered', 'dismissed', 'resolved']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export type AlertListQuery = z.infer<typeof alertListQuerySchema>
