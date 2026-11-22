# HSK 1 · Học tiếng Trung

Ứng dụng web học tiếng Trung HSK 1 (chuẩn HSK 3.0) theo **Giáo trình New HSK 1** (新HSK教程 1),
dành cho người học trưởng thành. Giao diện tiếng Việt, ưu tiên điện thoại, dùng được bằng một tay.

## Tính năng

- **Từ vựng** — chữ Hán, pinyin, nghĩa tiếng Việt, từ loại; nghe phát âm.
- **Bài khoá** — hội thoại theo sách, chạm từng câu để nghe, nút 0.6× để nghe chậm; nút ▶ đọc lần lượt từng câu và tô sáng câu đang đọc.
- **Chế độ đọc** — chỉ hiện chữ Hán; chạm vào một từ để xem pinyin, nghĩa, nghe và luyện viết.
- **Ngữ pháp** — giải thích, cấu trúc, ví dụ.
- **Luyện tập** — điền từ, chọn đáp án, dịch câu (sắp xếp từ), nghe hiểu, luyện từ vựng tự sinh. Câu hỏi và đáp án được xáo trộn mỗi lần; làm xong có nút “Làm lại N câu sai”.
- **Thanh điệu & pinyin** — nghe và chọn dãy thanh (vd. 3 · 3), gõ pinyin kèm số thanh (ni3 hao3).
- **Sổ lỗi** — câu sai được ghi lại, tự xoá khi làm đúng 2 lần liên tiếp.
- **Tra từ** — tìm theo chữ Hán, pinyin (có/không dấu, có số) hoặc tiếng Việt không dấu, nhóm theo bài.
- **Ôn tập** — thẻ từ với lặp lại ngắt quãng (spaced repetition): Hán → Việt, Việt → Hán, Nghe → Hán.
- **Trang chủ** — số từ đã học và điểm cao nhất của từng bài, một dòng mục tiêu mỗi ngày (vd. 12/20 thẻ).
- **Giọng đọc** — tự chọn giọng tiếng Trung tốt nhất trên máy, hoặc chọn trong Cá nhân.
- **Phông chữ Hán đi kèm** — hiển thị giống nhau trên mọi máy, kể cả khi offline.
- **Luyện viết** — xem thứ tự nét và tập viết bằng ngón tay (Hanzi Writer), có lưới 米字格.
- **Pinyin và nghĩa ẩn mặc định** — chạm để xem khi quên; có nút hiện tất cả, và tuỳ chọn luôn hiện trong phần Cá nhân.
- Tiến độ lưu trên thiết bị (localStorage), có sao lưu / khôi phục bằng file JSON. Hỗ trợ chế độ tối.
- **Đồng bộ điện thoại & máy tính** — tuỳ chọn, qua một gist riêng tư trên GitHub (xem bên dưới).

## Đồng bộ giữa các máy

1. Tạo token tại https://github.com/settings/tokens/new?scopes=gist (token classic, chỉ chọn quyền **gist**).
2. Trên mỗi máy: **Cá nhân → Đồng bộ** → dán token → **Bật đồng bộ**.

Ứng dụng tạo (hoặc tìm lại) gist riêng tư `hsk1-progress.json` và gộp tiến độ của các máy:
thẻ ôn lấy bản đã ôn nhiều hơn, điểm lấy điểm cao nhất, sổ lỗi lấy bản mới nhất.
“Xoá tiến độ” hoặc “Khôi phục” trên một máy sẽ thay tiến độ trên các máy khác.
Cài đặt hiển thị và token chỉ nằm trên từng máy, không được tải lên.

## Nội dung hiện có

Đủ 15 bài, đã nhập đầy đủ từ giáo trình (tr. 1–119): từ vựng, 3 bài khoá, ngữ pháp và bài tập của từng bài.
Cách sửa hoặc thêm nội dung: xem [docs/CONTENT_FORMAT.md](docs/CONTENT_FORMAT.md).
File âm thanh của sách: xem [audio/README.md](audio/README.md).

## Chạy thử

Không cần cài đặt hay build. Vì trình duyệt chặn `fetch` khi mở file trực tiếp, hãy chạy một máy chủ tĩnh:

```sh
python3 -m http.server 8000
# mở http://localhost:8000
```

## Triển khai (GitHub Pages)

1. Đổi repo sang công khai: **Settings → General → Danger Zone → Change visibility → Make public**.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)` → Save**.
3. Sau 1–2 phút, trang có tại `https://bunyu.github.io/data/`.

Mọi đường dẫn trong ứng dụng là tương đối nên chạy được ở thư mục con `/data/`.

## Dùng như ứng dụng trên iPhone

Mở trang bằng **Safari** → nút **Chia sẻ** → **Thêm vào MH chính** (Add to Home Screen).
Ứng dụng mở toàn màn hình, có biểu tượng riêng và dùng được khi không có mạng
(bài học, thẻ từ và dữ liệu luyện viết được lưu sẵn sau lần mở đầu tiên).
Lưu ý: tiến độ trong ứng dụng trên màn hình chính tách riêng với tiến độ trong Safari;
bật đồng bộ (hoặc dùng **Cá nhân → Sao lưu / Khôi phục**) để chuyển.

Khi cập nhật nội dung, tăng `VERSION` trong `sw.js` để điện thoại tải bản mới.

## Cấu trúc

```
index.html            khung trang + thanh điều hướng dưới
sw.js                 service worker (dùng offline)
icons/                biểu tượng ứng dụng (iPhone, Android)
css/app.css           giao diện (sáng/tối)
js/main.js            định tuyến, trang chủ, bài học, cài đặt
js/exercises.js       bài tập
js/review.js          thẻ từ + lặp lại ngắt quãng
js/words.js           tra từ, bảng từ (chế độ đọc), tách từ
js/drills.js          thanh điệu & pinyin, sổ lỗi
js/pinyin.js          tách âm tiết, thanh điệu, so sánh pinyin gõ vào
js/sync.js            đồng bộ qua GitHub Gist
js/audio.js           giọng đọc tiếng Trung
fonts/                phông chữ Hán đã lọc (tools/build_fonts.py)
js/write.js           luyện viết
js/store.js           lưu tiến độ
js/audio.js           âm thanh sách / giọng đọc trình duyệt
data/                 nội dung khoá học (JSON)
vendor/               Hanzi Writer (MIT) + dữ liệu nét chữ (Arphic Public License)
tools/vendor_hanzi.py đóng gói dữ liệu nét chữ cho các chữ trong bài
```

Nội dung bài học được nhập từ giáo trình để học cá nhân.
