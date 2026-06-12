import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIES, type CategorySlug } from './categories';

export type ArticleEntry = CollectionEntry<CategorySlug> & { category: CategorySlug };

export async function getAllArticles(): Promise<ArticleEntry[]> {
	const all = (
		await Promise.all(
			CATEGORIES.map(async (cat) => {
				const items = await getCollection(cat.slug);
				return items.map((item) => ({ ...item, category: cat.slug }));
			})
		)
	).flat();
	return all as ArticleEntry[];
}

export function slugifyTag(tag: string): string {
	const noDiacritics = Array.from(tag.toLowerCase().normalize('NFD'))
		.filter((ch) => {
			const code = ch.codePointAt(0) ?? 0;
			return code < 0x0300 || code > 0x036f;
		})
		.join('')
		.replace(/đ/g, 'd');

	return noDiacritics.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function getAllTags(): Promise<Map<string, string>> {
	const articles = await getAllArticles();
	const labels = new Map<string, string>();
	for (const article of articles) {
		for (const tag of article.data.tags ?? []) {
			const slug = slugifyTag(tag);
			if (!labels.has(slug)) labels.set(slug, tag);
		}
	}
	return labels;
}
