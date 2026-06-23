// Cào tin từ các nguồn RSS (cấu hình trong nguon-tin.json), bỏ bài đã đăng
// (đối chiếu da-cao.json), phân loại theo từ khóa, rồi xuất ra pool bài mới
// (scripts/tin-moi.json) để bước VIẾT chọn lọc.
//
// LƯU Ý: script này CHỈ thu thập sự kiện/tiêu đề/tóm tắt + link nguồn.
// Nó KHÔNG viết bài. Việc viết lại (theo checklist bản quyền) do agent làm.
//
// Cách dùng:
//   node scripts/cao-tin.mjs                 → cào & ghi scripts/tin-moi.json
//   node scripts/cao-tin.mjs --danh-dau A B  → đánh dấu link A, B là đã đăng

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const goocScript = __dirname;

const duongNguon = join(goocScript, 'nguon-tin.json');
const duongDaCao = join(goocScript, 'da-cao.json');
const duongTinMoi = join(goocScript, 'tin-moi.json');

// --- Tiện ích đọc/ghi sổ đã cào ---
function docDaCao() {
	try {
		return JSON.parse(readFileSync(duongDaCao, 'utf-8'));
	} catch {
		return { daCao: [] };
	}
}

function ghiDaCao(so) {
	writeFileSync(duongDaCao, JSON.stringify(so, null, '\t') + '\n', 'utf-8');
}

// --- Chế độ đánh dấu đã đăng ---
const thamSo = process.argv.slice(2);
if (thamSo[0] === '--danh-dau') {
	const links = thamSo.slice(1).filter(Boolean);
	if (!links.length) {
		console.error('Thiếu link để đánh dấu. Ví dụ: node scripts/cao-tin.mjs --danh-dau https://...');
		process.exit(1);
	}
	const so = docDaCao();
	const tap = new Set(so.daCao);
	let them = 0;
	for (const l of links) {
		if (!tap.has(l)) {
			tap.add(l);
			them++;
		}
	}
	so.daCao = Array.from(tap);
	ghiDaCao(so);
	console.log(`✅ Đã đánh dấu ${them} link mới là đã đăng. Tổng sổ: ${so.daCao.length}.`);
	process.exit(0);
}

// --- Gỡ CDATA & thẻ HTML, giải mã vài thực thể cơ bản ---
function lamSach(chuoi) {
	if (!chuoi) return '';
	let s = chuoi.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
	s = s.replace(/<[^>]+>/g, ' ');
	s = s
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&nbsp;/g, ' ');
	return s.replace(/\s+/g, ' ').trim();
}

// --- Lấy nội dung 1 thẻ trong block ---
function layThe(block, ten) {
	const m = block.match(new RegExp(`<${ten}[^>]*>([\\s\\S]*?)</${ten}>`, 'i'));
	return m ? m[1] : '';
}

// --- Tách các <item> trong RSS ---
function tachItems(xml) {
	const ds = [];
	const re = /<item[\s\S]*?<\/item>/gi;
	let m;
	while ((m = re.exec(xml)) !== null) ds.push(m[0]);
	return ds;
}

// --- Phân loại bài theo từ khóa; ưu tiên chuyên mục ngách (edit-video, xu-huong-kenh) ---
function phanLoai(tieuDe, moTa, mucMacDinh, tuKhoa) {
	const van = ` ${(tieuDe + ' ' + moTa).toLowerCase()} `;
	const diem = {};
	for (const [muc, ds] of Object.entries(tuKhoa)) {
		diem[muc] = 0;
		for (const k of ds) {
			if (van.includes(k.toLowerCase())) diem[muc] += 1;
		}
	}
	// Ngách được +1 ưu tiên nếu có khớp, để không bị nuốt bởi ai/kinh-doanh
	if (diem['edit-video'] > 0) diem['edit-video'] += 1;
	if (diem['xu-huong-kenh'] > 0) diem['xu-huong-kenh'] += 1;

	let mucTot = null;
	let diemTot = 0;
	for (const [muc, d] of Object.entries(diem)) {
		if (d > diemTot) {
			diemTot = d;
			mucTot = muc;
		}
	}
	return diemTot > 0 ? mucTot : mucMacDinh;
}

// --- Cào 1 feed với timeout ---
async function caoFeed(feed) {
	const ctrl = new AbortController();
	const hen = setTimeout(() => ctrl.abort(), 15000);
	try {
		const res = await fetch(feed.url, {
			signal: ctrl.signal,
			headers: { 'User-Agent': 'Mozilla/5.0 (HillTinTuc Bot)' },
		});
		if (!res.ok) {
			console.error(`  ⚠️  ${feed.ten}: HTTP ${res.status}`);
			return [];
		}
		const xml = await res.text();
		return tachItems(xml).map((it) => ({
			tieuDe: lamSach(layThe(it, 'title')),
			link: lamSach(layThe(it, 'link')) || lamSach(layThe(it, 'guid')),
			moTa: lamSach(layThe(it, 'description')),
			ngayGoc: lamSach(layThe(it, 'pubDate')),
			nguon: feed.ten,
			mucMacDinh: feed.mucMacDinh,
		}));
	} catch (e) {
		console.error(`  ⚠️  ${feed.ten}: ${e.message}`);
		return [];
	} finally {
		clearTimeout(hen);
	}
}

// --- Chạy chính ---
async function chinh() {
	const cauHinh = JSON.parse(readFileSync(duongNguon, 'utf-8'));
	const so = docDaCao();
	const daThay = new Set(so.daCao);

	console.log(`Cào ${cauHinh.feeds.length} nguồn...`);
	const ketQua = await Promise.all(cauHinh.feeds.map(caoFeed));
	const tatCa = ketQua.flat();

	// Bỏ bài thiếu link, bài đã đăng, bài trùng link trong cùng đợt
	const trungTrongDot = new Set();
	const moi = [];
	for (const bai of tatCa) {
		if (!bai.link || !bai.tieuDe) continue;
		if (daThay.has(bai.link) || trungTrongDot.has(bai.link)) continue;
		trungTrongDot.add(bai.link);
		bai.mucGoiY = phanLoai(bai.tieuDe, bai.moTa, bai.mucMacDinh, cauHinh.tuKhoa);
		const t = Date.parse(bai.ngayGoc);
		bai.thoiGian = Number.isNaN(t) ? 0 : t;
		moi.push(bai);
	}

	// Mới nhất trước
	moi.sort((a, b) => b.thoiGian - a.thoiGian);

	// Thống kê theo chuyên mục
	const dem = {};
	for (const b of moi) dem[b.mucGoiY] = (dem[b.mucGoiY] || 0) + 1;

	writeFileSync(
		duongTinMoi,
		JSON.stringify({ taoLuc: new Date().toISOString(), tongBaiMoi: moi.length, bai: moi }, null, '\t') + '\n',
		'utf-8'
	);

	console.log(`\n✅ ${moi.length} bài mới (chưa đăng) → scripts/tin-moi.json`);
	console.log('   Theo chuyên mục gợi ý:');
	for (const [muc, n] of Object.entries(dem).sort((a, b) => b[1] - a[1])) {
		console.log(`     ${muc}: ${n}`);
	}
}

chinh();
