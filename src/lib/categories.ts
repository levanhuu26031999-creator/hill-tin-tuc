export const CATEGORIES = [
	{ slug: 'ai', label: 'AI' },
	{ slug: 'marketing', label: 'Marketing' },
	{ slug: 'edit-video', label: 'Edit Video' },
	{ slug: 'kinh-doanh-online', label: 'Kinh doanh online' },
	{ slug: 'xu-huong-kenh', label: 'Xu hướng kênh' },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]['slug'];

export function getCategoryLabel(slug: string): string {
	return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}
