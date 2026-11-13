# Âm thanh giáo trình

Đặt file MP3 của sách vào thư mục này, đặt tên theo số track in trong sách:

```
audio/1-1.mp3   # Bài 1, track 1-1 (Bài khoá 1)
audio/1-3.mp3   # Bài 1, track 1-3 (Bài khoá 2)
audio/2-7.mp3   # Bài 2, bài vè
```

Mỗi bài khoá trong `data/lessons/*.json` có trường `"audio": "1-1"`. Khi có file, nút ▶ sẽ phát
bản ghi của sách; khi chưa có, ứng dụng dùng giọng đọc tiếng Trung của trình duyệt.
