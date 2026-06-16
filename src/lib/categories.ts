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

// Ngày đầy đủ tiếng Việt, ví dụ: "Thứ Sáu, 13 tháng 6, 2026"
export function dinhDangNgayDayDu(ngay: Date): string {
	return ngay.toLocaleDateString('vi-VN', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	});
}

// Khóa tháng dạng "YYYY-MM" (để nhóm & lọc bài theo tháng)
export function khoaThang(ngay: Date): string {
	return `${ngay.getFullYear()}-${String(ngay.getMonth() + 1).padStart(2, '0')}`;
}

// Khóa ngày dạng "YYYY-MM-DD" (để lọc bài theo đúng ngày)
export function khoaNgay(ngay: Date): string {
	return `${ngay.getFullYear()}-${String(ngay.getMonth() + 1).padStart(2, '0')}-${String(ngay.getDate()).padStart(2, '0')}`;
}
