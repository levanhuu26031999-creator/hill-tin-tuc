// Tạo ảnh bìa SVG cho từng bài viết.
// Mỗi bài một ảnh riêng: gradient theo màu mục + tên mục + tiêu đề + thương hiệu Hill.
// Ảnh gốc 100% (không vướng bản quyền), pipeline tự sinh được mà không cần API ngoài.
// Chạy: node scripts/tao-anh-bia.mjs

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const goocDuAn = join(__dirname, '..');
const thuMucContent = join(goocDuAn, 'src', 'content');
const thuMucXuat = join(goocDuAn, 'public', 'covers');

// Màu + nhãn từng mục (đồng bộ với src/styles/global.css và src/lib/categories.ts)
const CAU_HINH_MUC = {
	ai: { mau: '#7c3aed', nhan: 'AI' },
	marketing: { mau: '#ea580c', nhan: 'Marketing' },
	'edit-video': { mau: '#0891b2', nhan: 'Edit Video' },
	'kinh-doanh-online': { mau: '#16a34a', nhan: 'Kinh doanh online' },
	'xu-huong-kenh': { mau: '#db2777', nhan: 'Xu hướng kênh' },
};

const NAVY = '#0c2742';

// Đọc giá trị 1 field trong frontmatter (chuỗi đơn giản, có thể có dấu nháy bao ngoài).
function docFrontmatter(noiDung, ten) {
	const dong = noiDung.match(new RegExp(`^${ten}:\\s*(.+)$`, 'm'));
	if (!dong) return '';
	let giaTri = dong[1].trim();
	if (giaTri.startsWith('"') && giaTri.endsWith('"')) {
		// Chuỗi nháy kép YAML: bỏ nháy ngoài + giải mã ký tự thoát \" và \\
		giaTri = giaTri.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
	} else if (giaTri.startsWith("'") && giaTri.endsWith("'")) {
		// Chuỗi nháy đơn YAML: '' biểu thị một dấu nháy đơn
		giaTri = giaTri.slice(1, -1).replace(/''/g, "'");
	}
	return giaTri;
}

// Escape ký tự đặc biệt cho XML/SVG.
function thoatXml(chuoi) {
	return chuoi
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// Ngắt tiêu đề thành nhiều dòng (~24 ký tự/dòng), tối đa 4 dòng, dư thì thêm "…".
function ngatDong(tieuDe, soKyTuMoiDong = 24, soDongToiDa = 4) {
	const tu = tieuDe.split(/\s+/);
	const cacDong = [];
	let dongHienTai = '';
	for (const t of tu) {
		const thu = dongHienTai ? `${dongHienTai} ${t}` : t;
		if (thu.length > soKyTuMoiDong && dongHienTai) {
			cacDong.push(dongHienTai);
			dongHienTai = t;
		} else {
			dongHienTai = thu;
		}
	}
	if (dongHienTai) cacDong.push(dongHienTai);
	if (cacDong.length > soDongToiDa) {
		const catBot = cacDong.slice(0, soDongToiDa);
		catBot[soDongToiDa - 1] = catBot[soDongToiDa - 1].replace(/[…\s]+$/, '') + '…';
		return catBot;
	}
	return cacDong;
}

// Sinh chuỗi SVG cho 1 bài.
function taoSvg({ tieuDe, mauMuc, nhanMuc }) {
	const cacDong = ngatDong(tieuDe);
	const yBatDau = 300 - (cacDong.length - 1) * 33;
	const tspanTieuDe = cacDong
		.map(
			(dong, i) =>
				`<tspan x="80" y="${yBatDau + i * 66}">${thoatXml(dong)}</tspan>`
		)
		.join('');

	return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<linearGradient id="nen" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="${mauMuc}"/>
			<stop offset="0.55" stop-color="${NAVY}"/>
			<stop offset="1" stop-color="${NAVY}"/>
		</linearGradient>
	</defs>
	<rect width="1200" height="630" fill="url(#nen)"/>
	<circle cx="1080" cy="120" r="280" fill="${mauMuc}" opacity="0.18"/>
	<circle cx="1180" cy="560" r="180" fill="#ffffff" opacity="0.05"/>
	<rect x="80" y="80" rx="999" width="${nhanMuc.length * 17 + 56}" height="48" fill="rgba(255,255,255,0.16)"/>
	<text x="108" y="112" font-family="'Be Vietnam Pro', Arial, sans-serif" font-size="24" font-weight="700" fill="#ffffff" letter-spacing="1">${thoatXml(nhanMuc.toUpperCase())}</text>
	<text font-family="'Be Vietnam Pro', Arial, sans-serif" font-size="52" font-weight="800" fill="#ffffff" letter-spacing="-0.5">${tspanTieuDe}</text>
	<circle cx="92" cy="556" r="12" fill="${mauMuc}"/>
	<text x="116" y="566" font-family="'Be Vietnam Pro', Arial, sans-serif" font-size="30" font-weight="800" fill="#ffffff">Hill Tin Tức</text>
	<text x="1120" y="566" text-anchor="end" font-family="'Be Vietnam Pro', Arial, sans-serif" font-size="22" fill="rgba(255,255,255,0.7)">hill-tin-tuc.vercel.app</text>
</svg>
`;
}

let soLuong = 0;
for (const muc of Object.keys(CAU_HINH_MUC)) {
	const duongMuc = join(thuMucContent, muc);
	let tepTin;
	try {
		tepTin = readdirSync(duongMuc).filter((t) => t.endsWith('.md'));
	} catch {
		continue; // mục chưa có bài
	}

	mkdirSync(join(thuMucXuat, muc), { recursive: true });

	for (const tep of tepTin) {
		const noiDung = readFileSync(join(duongMuc, tep), 'utf-8');
		const tieuDe = docFrontmatter(noiDung, 'title');
		if (!tieuDe) continue;

		const slug = tep.replace(/\.md$/, '');
		const svg = taoSvg({
			tieuDe,
			mauMuc: CAU_HINH_MUC[muc].mau,
			nhanMuc: CAU_HINH_MUC[muc].nhan,
		});
		writeFileSync(join(thuMucXuat, muc, `${slug}.svg`), svg, 'utf-8');
		soLuong++;
	}
}

console.log(`Đã tạo ${soLuong} ảnh bìa trong public/covers/`);
