# Quy trình đăng bài Hill Tin Tức (bán tự động)

Quy trình lặp lại cho mỗi bài viết mới. Người viết lại nội dung là **LLM (Claude)** trong phiên làm việc;
con người (anh Hửu) **duyệt trước khi đăng**. Cách này an toàn bản quyền tuyệt đối và không phụ thuộc task nền.

> Khi anh nói "viết bài cho Hill Tin Tức từ [link/chủ đề]", làm theo đúng 5 bước dưới đây.

---

## Bước 1 — Gom nguồn (chỉ lấy sự kiện & số liệu)

- Nhận 1 link bài báo (hoặc 1 chủ đề → tự tìm 1–2 nguồn công khai uy tín).
- Đọc nguồn, **chỉ ghi lại**: tên riêng/địa danh/cơ quan, con số, ngày tháng, sự kiện đã xảy ra.
- **KHÔNG** chép câu chữ, **KHÔNG** giữ cấu trúc lập luận của bài gốc.

## Bước 2 — Viết lại 100% bằng văn phong Hill

- Viết hoàn toàn bằng ngôn ngữ riêng, **không nhìn vào câu chữ nguồn**.
- Giọng: gần gũi, như người trong nghề chia sẻ — hợp đối tượng học edit/marketing/kinh doanh online.
- **Bắt buộc** có ít nhất 1 đoạn **"Góc nhìn Hill Media"**: phân tích/ý nghĩa/lời khuyên thực tế
  không có trong nguồn (liên hệ tới người làm kênh, học CapCut, kiếm thu nhập từ kỹ năng...).
- Chọn `category` đúng: `ai` | `marketing` | `edit-video` | `kinh-doanh-online` | `xu-huong-kenh`.
- Đặt 3–6 `tags` ngắn gọn, có dấu tiếng Việt cũng được (slug tự xử lý).
- `summary`: 1–2 câu, hấp dẫn, không spoiler hết.

## Bước 3 — Tạo file nháp bằng script

Viết metadata + nội dung ra 1 file JSON tạm (ví dụ `/tmp/bai.json`) rồi chạy:

```bash
node scripts/tao-bai-moi.mjs /tmp/bai.json
```

JSON gồm: `category, title, source, sourceUrl, summary, tags[], body` (xem mẫu trong đầu file script).
Script tự sinh slug tiếng Việt, frontmatter chuẩn, đặt đúng `src/content/<category>/`, chặn trùng file.

## Bước 4 — Anh Hửu duyệt

- Đọc lại bản nháp, chỉnh sửa nếu cần.
- **Chạy checklist bản quyền bên dưới** trước khi đồng ý đăng.

## Bước 5 — Đăng

```bash
npm run build      # prebuild tự sinh ảnh bìa cho bài mới
git add src/content/<category>/<slug>.md public/covers/<category>/<slug>.svg
git commit -m "Bài mới: <tiêu đề>"
git push origin main   # Vercel tự deploy
```

---

## Checklist bản quyền (chạy sau mỗi bài, trước khi đăng)

```
[ ] Không có câu nào >5 từ liên tiếp giống bài báo gốc
[ ] Không copy cấu trúc lập luận của nguồn
[ ] Có ít nhất 1 góc nhìn/giá trị riêng (đoạn "Góc nhìn Hill Media")
[ ] Có dòng dẫn nguồn rõ ràng (source + sourceUrl)
[ ] Giọng văn nhất quán với kênh (gần gũi, người trong nghề)
[ ] Chỉ lấy từ nguồn công khai, được phép trích dẫn lại
```

---

## Ghi chú kiến trúc

- Đây là **Hướng C — bán tự động** (anh Hửu chọn 2026-06-13). Né được bug "scheduled task ghi file
  không persist" vì chạy ngay trong phiên, không phải task nền.
- Nếu sau này muốn tự động hẳn: cân nhắc GitHub Actions cron + Anthropic API key (Hướng B) — chắc chắn,
  chạy trên cloud, nhưng tốn phí và cần khóa API.
