# Định dạng nội dung

Toàn bộ nội dung nằm trong `data/`. Không cần build: sửa JSON, tải lại trang.

## `data/course.json`

Danh sách 15 bài theo mục lục giáo trình. Bài nào có `"file"` thì đã có nội dung đầy đủ;
bài chưa có `"file"` hiển thị "Sắp có" cùng danh sách ngữ pháp.

```json
{ "id": 4, "file": "lessons/04.json", "zh": "我有两个孩子", "vi": "Chị có hai con", "page": 18, "grammar": ["…"] }
```

## `data/lessons/NN.json`

| Trường | Ý nghĩa |
|---|---|
| `id`, `zh`, `pinyin`, `vi` | Số bài và tên bài |
| `source` | Trang trong giáo trình |
| `objectives` | Mục tiêu bài học |
| `speakers` | Nhân vật trong bài khoá: `{ "yf": { "zh": "王一飞", "pinyin": "Wáng Yīfēi", "vi": "Vương Nhất Phi" } }` |
| `vocab` | Từ mới (xem bên dưới) |
| `texts` | Bài khoá (hội thoại) |
| `rhyme` | Bài vè / câu nói vần (tuỳ chọn) |
| `grammar` | Điểm ngữ pháp |
| `exercises` | Bài tập |

### Từ vựng

```json
{ "id": "3-04", "hanzi": "谁", "pinyin": "shéi/shuí", "pos": "pron", "vi": "ai" }
```

- `id` phải duy nhất trong toàn bộ khoá học — tiến độ ôn tập (spaced repetition) lưu theo `id`.
  Quy ước: `<bài>-<số thứ tự trong sách>`, danh từ riêng dùng `<bài>-p<n>` và `"proper": true`.
- `pos`: `n` danh từ · `pron` đại từ · `v` động từ · `adj` tính từ · `adv` phó từ · `part` trợ từ ·
  `interj` thán từ · `num` số từ · `mw` lượng từ · `prep` giới từ · `conj` liên từ · `suffix` hậu tố.
  Để trống nếu sách không ghi.

### Bài khoá

```json
{
  "id": "3-5", "title": "Bài khoá 3", "audio": "3-5",
  "context": "Bối cảnh (tiếng Việt)",
  "note": "Ghi chú “Tiểu Ngữ giúp sức” (tuỳ chọn)",
  "lines": [ { "s": "yx", "zh": "喂，一飞！", "pinyin": "Wèi, Yīfēi!", "vi": "A lô, Nhất Phi à!" } ]
}
```

`audio` là số track trong sách → file `audio/3-5.mp3`.

### Ngữ pháp

```json
{ "id": "3-g1", "zh": "“是”字句", "vi": "Câu chữ “是”", "pattern": "A + 是 + B",
  "explain": "…", "examples": [ { "zh": "我是法国人。", "pinyin": "Wǒ shì Fǎguó rén.", "vi": "Mình là người Pháp." } ] }
```

### Bài tập

Bốn dạng. `answer` là chỉ số (bắt đầu từ 0) của đáp án đúng trong `options`, trừ dạng `order`.

```json
{ "type": "choice", "prompt": "Câu hỏi", "options": ["A", "B", "C", "D"], "answer": 0 }
{ "type": "fill",   "sentence": "你工作忙___？", "vi": "Nghĩa câu", "options": ["哪", "吗"], "answer": 1 }
{ "type": "order",  "vi": "Câu tiếng Việt cần dịch", "tiles": ["我", "叫", "李文", "。"], "answer": "我叫李文。", "accept": ["…"] }
{ "type": "listen", "say": "我是法国人。", "prompt": "Người nói là người nước nào?", "options": ["Pháp", "…"], "answer": 0 }
```

- `fill`: `___` (3 dấu gạch dưới) đánh dấu chỗ trống.
- `order`: dấu câu trong `tiles` được bỏ qua khi chấm; `accept` liệt kê các cách sắp xếp khác cũng đúng.
- `listen`: `say` được đọc bằng giọng đọc trình duyệt.
- `"source": "book"` đánh dấu bài tập lấy nguyên từ sách.

Ngoài ra, phần **Luyện từ vựng** tự sinh câu hỏi (chọn nghĩa, chọn chữ Hán, nghe chọn từ) từ `vocab`.

### Dữ liệu nét chữ

Sau khi thêm bài mới, chạy lại để đóng gói dữ liệu nét cho chữ mới (dùng offline):

```sh
npm pack hanzi-writer-data@2.0.1 && tar xzf hanzi-writer-data-2.0.1.tgz
python3 tools/vendor_hanzi.py package/
```

Nếu thiếu, ứng dụng tự tải từ CDN jsDelivr.
