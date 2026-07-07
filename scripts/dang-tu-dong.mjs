// Pipeline đăng bài tự động cho Hill Tin Tức — chạy trên GitHub Actions (cloud).
// Không cần mở app, không cần duyệt quyền: cào RSS → chọn bài → đọc nguồn lấy
// dữ kiện → gọi Google Gemini viết lại 100% giọng kênh (có checklist bản quyền)
// → tạo file .md + ảnh bìa → cập nhật sổ chống trùng. Việc git commit/push do
// workflow lo (xem .github/workflows/cao-tin.yml).
//
// Dùng Gemini vì có gói MIỄN PHÍ (lấy key ở aistudio.google.com, không cần thẻ).
//
// Biến môi trường:
//   GEMINI_API_KEY  (bắt buộc) — khóa API Google Gemini, đặt trong GitHub Secrets
//   HILL_MODEL      (tùy chọn) — model, mặc định gemini-2.5-flash (free)
//   HILL_SO_BAI     (tùy chọn) — số bài mỗi lần, mặc định 5

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const here = dirname(fileURLToPath(import.meta.url));
const gooc = join(here, '..');

const MODEL = process.env.HILL_MODEL || 'gemini-2.5-flash';
const SO_BAI = Number(process.env.HILL_SO_BAI || 5);
const MUC_HOP_LE = ['ai', 'marketing', 'edit-video', 'kinh-doanh-online', 'xu-huong-kenh'];

if (!process.env.GEMINI_API_KEY) {
	console.error('❌ Thiếu GEMINI_API_KEY. Lấy free ở aistudio.google.com rồi đặt trong GitHub Secrets.');
	process.exit(1);
}

// --- Tiện ích chạy lệnh node ---
function chayNode(tep, thamSo = '') {
	execSync(`node ${JSON.stringify(join(here, tep))} ${thamSo}`, { stdio: 'inherit', cwd: gooc });
}

// --- Chuẩn hóa văn bản để so khớp bản quyền (bỏ dấu, ký tự lạ) ---
function chuanHoa(t) {
	return (t || '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/đ/g, 'd')
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

// --- Checklist bản quyền: trả về cụm >5 từ trùng nếu có, ngược lại null ---
function timTrung(body, nguon) {
	const b = chuanHoa(body).split(' ');
	const n = ' ' + chuanHoa(nguon) + ' ';
	for (let i = 0; i + 6 <= b.length; i++) {
		const cum = b.slice(i, i + 6).join(' ');
		if (cum.length > 18 && n.includes(' ' + cum + ' ')) return cum;
	}
	return null;
}

// --- Đọc trang nguồn lấy dữ kiện (chỉ để AI có sự kiện/số liệu, KHÔNG copy) ---
async function layDuKien(item) {
	try {
		const ctrl = new AbortController();
		const hen = setTimeout(() => ctrl.abort(), 15000);
		const r = await fetch(item.link, {
			signal: ctrl.signal,
			headers: { 'User-Agent': 'Mozilla/5.0 (HillTinTuc Bot)' },
		});
		clearTimeout(hen);
		if (!r.ok) return item.moTa;
		const html = await r.text();
		let s = html
			.replace(/<script[\s\S]*?<\/script>/gi, ' ')
			.replace(/<style[\s\S]*?<\/style>/gi, ' ')
			.replace(/<[^>]+>/g, ' ')
			.replace(/&[a-z#0-9]+;/gi, ' ')
			.replace(/\s+/g, ' ')
			.trim();
		return (item.moTa + ' ' + s).slice(0, 4500);
	} catch {
		return item.moTa;
	}
}

// --- Chọn N bài rải đều chuyên mục (mới nhất trước) ---
function chonBai(pool) {
	const nhom = {};
	for (const b of pool.bai) (nhom[b.mucGoiY] ||= []).push(b);
	const mucs = Object.keys(nhom);
	const chon = [];
	let i = 0;
	while (chon.length < SO_BAI && mucs.some((m) => nhom[m].length)) {
		const m = mucs[i % mucs.length];
		if (nhom[m].length) chon.push(nhom[m].shift());
		i++;
	}
	return chon;
}

// --- Schema JSON bắt buộc cho bài viết (định dạng Gemini) ---
const SCHEMA = {
	type: 'OBJECT',
	properties: {
		category: { type: 'STRING', enum: MUC_HOP_LE },
		title: { type: 'STRING' },
		summary: { type: 'STRING' },
		tags: { type: 'ARRAY', items: { type: 'STRING' } },
		body: { type: 'STRING' },
	},
	required: ['category', 'title', 'summary', 'tags', 'body'],
	propertyOrdering: ['category', 'title', 'summary', 'tags', 'body'],
};

const HE_THONG = `Bạn là biên tập viên của "Hill Tin Tức" — trang tin của anh Lê Văn Hửu (Hill Media), phục vụ người Việt quan tâm AI, Marketing, Edit Video, Kinh doanh online, Xu hướng kênh.
Nhiệm vụ: từ DỮ KIỆN thô của một bản tin, VIẾT LẠI HOÀN TOÀN một bài mới bằng ngôn ngữ của mình.
QUY TẮC BẮT BUỘC:
- KHÔNG sao chép câu chữ nguồn. Không có cụm >5 từ liên tiếp giống nguồn.
- Không giữ cấu trúc lập luận của nguồn. Chỉ lấy sự kiện, số liệu, tên riêng, ngày tháng.
- KHÔNG bịa số liệu. Nếu dữ kiện không rõ, viết chung chung thay vì bịa con số.
- Giọng gần gũi, rõ ràng, như chuyên gia nói với người quen. Dài 350–600 chữ, markdown, có vài heading "## ".
- Bắt buộc có 1 đoạn cuối "## Góc nhìn Hill Media" phân tích/ứng dụng cho người làm nội dung & kinh doanh online ở VN.
- title: tự đặt tiêu đề mới, hấp dẫn, không copy. summary: 1-2 câu. tags: 2-4 thẻ tiếng Việt.
- category: chọn đúng 1 trong: ${MUC_HOP_LE.join(', ')} theo nội dung thực tế.
Trả về đúng JSON theo schema.`;

async function vietBai(ai, item, duKien) {
	const res = await ai.models.generateContent({
		model: MODEL,
		contents: `Nguồn: ${item.nguon}\nChuyên mục gợi ý: ${item.mucGoiY}\nTiêu đề gốc (chỉ tham khảo, không copy): ${item.tieuDe}\n\nDỮ KIỆN THÔ (chỉ lấy sự kiện/số liệu, viết lại hoàn toàn):\n${duKien}`,
		config: {
			systemInstruction: HE_THONG,
			responseMimeType: 'application/json',
			responseSchema: SCHEMA,
			temperature: 0.85,
			maxOutputTokens: 4000,
		},
	});
	const text = res.text;
	if (!text) throw new Error('Không có nội dung trả về');
	return JSON.parse(text);
}

// --- Chạy chính ---
async function chinh() {
	console.log(`Model: ${MODEL} · Số bài/lần: ${SO_BAI}`);

	// 1. Cào (dùng lại cao-tin.mjs)
	chayNode('cao-tin.mjs');
	const pool = JSON.parse(readFileSync(join(here, 'tin-moi.json'), 'utf-8'));
	if (!pool.bai.length) {
		console.log('Không có tin mới. Dừng.');
		return;
	}

	const chon = chonBai(pool);
	console.log(`Chọn ${chon.length} bài để viết.`);

	const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
	const daDang = [];
	let stt = 0;

	for (const item of chon) {
		stt++;
		try {
			const duKien = await layDuKien(item);
			const bai = await vietBai(ai, item, duKien);

			if (!MUC_HOP_LE.includes(bai.category)) bai.category = item.mucGoiY;
			const trung = timTrung(bai.body, duKien);
			if (trung) {
				console.log(`  ⚠️ Bỏ "${bai.title}" — dính cụm giống nguồn: "${trung}"`);
				continue;
			}

			// Gắn nguồn + tạo file qua tao-bai-moi.mjs
			bai.source = item.nguon;
			bai.sourceUrl = item.link;
			const tamJson = join(here, `bai-tam-${stt}.json`);
			writeFileSync(tamJson, JSON.stringify(bai), 'utf-8');
			try {
				chayNode('tao-bai-moi.mjs', JSON.stringify(tamJson));
				daDang.push(item.link);
			} catch (e) {
				console.log(`  ⚠️ Không tạo được file cho "${bai.title}" (có thể trùng): ${e.message}`);
			} finally {
				try {
					unlinkSync(tamJson);
				} catch {}
			}
		} catch (e) {
			console.log(`  ⚠️ Lỗi khi viết bài ${stt}: ${e.message}`);
		}
	}

	if (!daDang.length) {
		console.log('Không đăng được bài nào lần này.');
		return;
	}

	// Sinh ảnh bìa cho bài mới
	chayNode('tao-anh-bia.mjs');

	// Đánh dấu đã đăng (chống trùng lần sau)
	const args = daDang.map((l) => JSON.stringify(l)).join(' ');
	chayNode('cao-tin.mjs', `--danh-dau ${args}`);

	console.log(`\n✅ Đã tạo ${daDang.length} bài mới. Workflow sẽ commit & push.`);
}

chinh().catch((e) => {
	console.error('Lỗi pipeline:', e);
	process.exit(1);
});
