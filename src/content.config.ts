import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articleSchema = z.object({
	title: z.string(),
	date: z.coerce.date(),
	source: z.string(),
	sourceUrl: z.string().url(),
	summary: z.string(),
	tags: z.array(z.string()).optional(),
});

const articleCollection = (dir: string) =>
	defineCollection({
		loader: glob({ pattern: '**/*.md', base: `./src/content/${dir}` }),
		schema: articleSchema,
	});

export const collections = {
	ai: articleCollection('ai'),
	marketing: articleCollection('marketing'),
	'edit-video': articleCollection('edit-video'),
	'kinh-doanh-online': articleCollection('kinh-doanh-online'),
};
