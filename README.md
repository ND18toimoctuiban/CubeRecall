# CubeRecall

CubeRecall là trang web tĩnh giúp học và luyện công thức OLL, PLL trong CFOP.

## Tính năng

- Tra cứu 57 trường hợp OLL và 21 trường hợp PLL, có tìm kiếm và lọc theo nhóm.
- Học bằng flashcard có hình minh họa và kiểm tra với câu hỏi, đáp án được xáo trộn.
- Xem các công thức mirror ngay cạnh trường hợp liên quan.
- Tạo chuỗi setup bằng cách đảo ngược công thức để đưa một khối đã giải về case OLL/PLL; xem hình trạng thái khối và sao chép chuỗi setup.
- Tạo scramble 3×3, xem lưới trạng thái sáu mặt và dùng timer để ghi thời gian giải.
- Lưu scramble, xem kết quả gần đây, best time và AO5.

## Chạy trang web

Mở `index.html` bằng trình duyệt hoặc phục vụ các file trong thư mục này bằng một static web server. Trang không cần bước build hay backend.

Để xuất bản bằng GitHub Pages, tải các file `index.html`, `styles.css`, `data.js` và `app.js` lên thư mục gốc của repository. Sau đó vào **Settings → Pages**, chọn nhánh `main` và thư mục `/(root)` làm nguồn xuất bản.

## Lưu dữ liệu

Trạng thái “Đã thuộc”, lịch sử timer và scramble đã lưu được giữ trong `localStorage` của trình duyệt. Dữ liệu này không tự đồng bộ giữa các thiết bị hoặc trình duyệt.

## Nguồn tham khảo

- [57 công thức OLL – RubikOnline.vn](https://rubikonline.vn/57-cong-thuc-oll-tao-mat-vang-cfop)
- [21 công thức PLL – RubikOnline.vn](https://rubikonline.vn/21-cong-thuc-pll-hoan-vi-tang-cuoi-cung-cfop)

Hình minh họa được tải trực tiếp từ máy chủ của nguồn tham khảo. Công thức và hình minh họa từ các nguồn bên ngoài không thuộc giấy phép của code CubeRecall; việc sử dụng lại cần tuân theo điều khoản của chủ sở hữu tương ứng.

## Giấy phép

Code của CubeRecall được phát hành theo giấy phép MIT. Giấy phép này không áp dụng cho nội dung bên ngoài được nêu trong mục Nguồn tham khảo.
