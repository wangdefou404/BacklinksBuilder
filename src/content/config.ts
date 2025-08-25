import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.string().transform((str) => {
      const date = new Date(str);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date: ${str}`);
      }
      return date;
    }),
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
    image: z.string().optional(),
    featured: z.boolean().optional(),
    draft: z.boolean().optional(),
  }),
});

export const collections = {
  blog
};