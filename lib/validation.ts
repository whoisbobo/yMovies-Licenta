import { z } from "zod";

export const pageParamSchema = z
  .string()
  .optional()
  .transform((val) => {
    const parsed = parseInt(val ?? "1", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });

export const homeSearchParamsSchema = z.object({
  search: z.string().trim().max(200).optional(),
  genre: z.coerce.number().int().positive().optional().catch(undefined),
  name: z.string().trim().max(100).optional(),
  page: pageParamSchema,
});

export const movieIdParamSchema = z.coerce.number().int().positive();

export const mediaTypeParamSchema = z
  .enum(["movie", "tv"])
  .optional()
  .catch("movie")
  .transform((val) => val ?? "movie");
