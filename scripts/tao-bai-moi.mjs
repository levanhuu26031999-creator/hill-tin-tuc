// Tạo file bài viết mới cho Hill Tin Tức từ một file JSON metadata + nội dung.
// Dùng trong quy trình bán tự động: LLM viết lại bài (theo checklist bản quyền)
// ra JSON, script này lo phần slug/frontmatter/đặt file cho chuẩn.
//
// Cách dùng:
//   node scripts/tao-bai-moi.mjs duong-dan.json [--ghi-de]
//
// Cấu trúc JSON:
//   {
//     "category": "ai",                       // bắt buộc: ai | marketing | edit-video | kinh-doanh-online | xu-huong-kenh
//     "title": "Tiêu đề bài",                 // bắt buộc
//     "source": "Tên nguồn",                  // bắt buộc
//     "sourceUrl": "https://...",             // bắt buộc
//     "summary": "Tóm tắt 1-2 câu",           // bắt buộc
//     "tags": ["ai", "capcut"],               // tùy chọn
//     "date": "2026-06-13",                   // tùy chọn (mặc định hôm nay)
//     "slug": "slug-tuy-chinh",               // tùy chọn (mặc định sinh từ title)
//     "body": "Nội dung markdown..."          // bắt buộc
//   }

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const goocDuAn = join(__dirname, '..');

const MUC_HOP_LE = ['ai', 'marketing', 'edit-video', 'kinh-doanh-online', 'xu-huong-kenh'];

// Tạo slug an toàn từ tiếng Việt: bỏ dấu, đ→d, ký tự lạ → gạch ngang.
function taoSlug(chuoi) {
	const boDau = Array.from(chuoi.toLowerCase().normalize('NFD'))
		.filter((kt) => {
			const ma = kt.codePointAt(0) ?? 0;
			return ma < 0x0300 || ma > 0x036f;
		})
		.join('')
		.replace(/đ/g, 'd');
	return boDau.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Ngày hôm nay dạng YYYY-MM-DD theo giờ địa phương.
function ngayHomNay() {
	const d = new Date();
	const thang = String(d.getMonth() + 1).padStart(2, '0');
	const ngay = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${thang}-${ngay}`;
}

// --- Đọc tham số ---
const thamSo = process.argv.slice(2);
const ghiDe = thamSo.includes('--ghi-de');
const duongJson = thamSo.find((t) => !t.startsWith('--'));

if (!duongJson) {
	console.error('Thiếu đường dẫn file JSON. Ví dụ: node scripts/tao-bai-moi.mjs bai.json');
	process.exit(1);
}

let dl;
try {
	dl = JSON.parse(readFileSync(duongJson, 'utf-8'));
} catch (e) {
	console.error(`Không đọc được JSON: ${e.message}`);
	process.exit(1);
}

// --- Kiểm tra bắt buộc ---
const thieu = ['category', 'title', 'source', 'sourceUrl', 'summary', 'body'].filter(
	(k) => !dl[k] || String(dl[k]).trim() === ''
);
if (thieu.length) {
	console.error(`Thiếu trường bắt buộc: ${thieu.join(', ')}`);
	process.exit(1);
}
if (!MUC_HOP_LE.includes(dl.category)) {
	console.error(`category "${dl.category}" không hợp lệ. Chọn: ${MUC_HOP_LE.join(', ')}`);
	process.exit(1);
}

const slug = dl.slug ? taoSlug(dl.slug) : taoSlug(dl.title);
const ngay = dl.date || ngayHomNay();
const thuMuc = join(goocDuAn, 'src', 'content', dl.category);
const duongFile = join(thuMuc, `${slug}.md`);

if (existsSync(duongFile) && !ghiDe) {
	console.error(`File đã tồn tại: ${duongFile}\nDùng --ghi-de để ghi đè.`);
	process.exit(1);
}

// --- Dựng frontmatter (JSON.stringify để escape an toàn dấu nháy) ---
const tags = Array.isArray(dl.tags) ? dl.tags : [];
const dongTags = tags.length
	? `tags: [${tags.map((t) => JSON.stringify(t)).join(', ')}]\n`
	: '';

const frontmatter =
	`---\n` +
	`title: ${JSON.stringify(dl.title)}\n` +
	`date: ${ngay}\n` +
	`source: ${JSON.stringify(dl.source)}\n` +
	`sourceUrl: ${JSON.stringify(dl.sourceUrl)}\n` +
	`summary: ${JSON.stringify(dl.summary)}\n` +
	dongTags +
	`---\n\n`;

mkdirSync(thuMuc, { recursive: true });
writeFileSync(duongFile, frontmatter + dl.body.trim() + '\n', 'utf-8');

console.log(`✅ Đã tạo: src/content/${dl.category}/${slug}.md`);
console.log(`   URL khi đăng: /${dl.category}/${slug}/`);
console.log(`   Ảnh bìa sẽ tự sinh khi build (npm run covers).`);
