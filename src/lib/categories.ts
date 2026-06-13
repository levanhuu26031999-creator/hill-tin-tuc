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

// Đường dẫn ảnh bìa: ưu tiên ảnh khai báo trong frontmatter (`cover`),
// nếu không có thì dùng ảnh thiết kế sẵn theo quy ước /covers/<mục>/<slug>.svg
export function duongDanAnhBia(category: string, id: string, cover?: string): string {
	return cover ?? `/covers/${category}/${id}.svg`;
}
