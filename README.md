# HSK 1 · Học tiếng Trung

Ứng dụng web học tiếng Trung HSK 1 (chuẩn HSK 3.0) theo **Giáo trình New HSK 1** (新HSK教程 1),
dành cho người học trưởng thành. Giao diện tiếng Việt, ưu tiên điện thoại, dùng được bằng một tay.

## Tính năng

- **Từ vựng** — chữ Hán, pinyin, nghĩa tiếng Việt, từ loại; nghe phát âm.
- **Bài khoá** — hội thoại theo sách, chạm từng câu để nghe; phát cả bài bằng file âm thanh của sách (khi có).
- **Ngữ pháp** — giải thích, cấu trúc, ví dụ.
- **Luyện tập** — điền từ, chọn đáp án, dịch câu (sắp xếp từ), nghe hiểu, luyện từ vựng tự sinh.
- **Ôn tập** — thẻ từ với lặp lại ngắt quãng (spaced repetition), hai chiều Hán → Việt / Việt → Hán.
- **Luyện viết** — xem thứ tự nét và tập viết bằng ngón tay (Hanzi Writer), có lưới 米字格.
- **Pinyin và nghĩa ẩn mặc định** — chạm để xem khi quên; có nút hiện tất cả, và tuỳ chọn luôn hiện trong phần Cá nhân.
- Tiến độ lưu trên thiết bị (localStorage), có sao lưu / khôi phục bằng file JSON. Hỗ trợ chế độ tối.

## Nội dung hiện có

Mục lục đủ 15 bài. Bài 1–3 đã nhập đầy đủ từ giáo trình (tr. 1–17). Các bài 4–15 hiển thị
"Sắp có" kèm danh sách ngữ pháp. Cách thêm bài: xem [docs/CONTENT_FORMAT.md](docs/CONTENT_FORMAT.md).
File âm thanh của sách: xem [audio/README.md](audio/README.md).

## Chạy thử

Không cần cài đặt hay build. Vì trình duyệt chặn `fetch` khi mở file trực tiếp, hãy chạy một máy chủ tĩnh:

```sh
python3 -m http.server 8000
# mở http://localhost:8000
```

## Triển khai

Đây là trang tĩnh: có thể đưa lên GitHub Pages (Settings → Pages → Deploy from branch → `main` / root),
Netlify, Cloudflare Pages hoặc Vercel. Lưu ý: GitHub Pages cho repo **riêng tư** cần gói GitHub trả phí.

## Cấu trúc

```
index.html            khung trang + thanh điều hướng dưới
css/app.css           giao diện (sáng/tối)
js/main.js            định tuyến, trang chủ, bài học, cài đặt
js/exercises.js       bài tập
js/review.js          thẻ từ + lặp lại ngắt quãng
js/write.js           luyện viết
js/store.js           lưu tiến độ
js/audio.js           âm thanh sách / giọng đọc trình duyệt
data/                 nội dung khoá học (JSON)
vendor/               Hanzi Writer (MIT) + dữ liệu nét chữ (Arphic Public License)
tools/vendor_hanzi.py đóng gói dữ liệu nét chữ cho các chữ trong bài
```

Nội dung bài học được nhập từ giáo trình để học cá nhân; giữ repo ở chế độ riêng tư.
