import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z
    .object({
      title: z.string().min(1),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      draft: z.boolean().default(false),
      description: z.string().min(1),
      taxonomies: z
        .object({
          tags: z.array(z.string().min(1)).default([]),
        })
        .default({ tags: [] }),
    })
    .transform((data) => ({
      ...data,
      tags: data.taxonomies.tags,
    })),
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    tech: z.array(z.string().min(1)).default([]),
    url: z.url(),
    order: z.number().int().default(0),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, projects };
