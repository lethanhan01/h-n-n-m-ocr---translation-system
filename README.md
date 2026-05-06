# Hán Nôm OCR & Translation System

## Giới thiệu
Dự án **Hán Nôm OCR & Translation System** là một ứng dụng web tiên tiến được thiết kế để hỗ trợ bảo tồn và nghiên cứu các tài liệu Hán Nôm cổ. Ứng dụng tích hợp công nghệ trí tuệ nhân tạo (Gemini API) để nhận diện ký tự (OCR), phiên âm Hán Việt và dịch nghĩa sang tiếng Việt hiện đại.

Điểm đặc biệt của ứng dụng là khả năng trình bày văn bản theo phong cách truyền thống (chiều dọc, từ phải sang trái) và hỗ trợ xử lý trực tiếp trên các tệp tài liệu PDF nhiều trang.

## Tính năng chính
- **Nhận diện OCR chuyên sâu**: Sử dụng mô hình AI mạnh mẽ để nhận diện các ký tự Hán Nôm phức tạp từ hình ảnh hoặc tài liệu quét.
- **Hỗ trợ tệp PDF & Hình ảnh**: Người dùng có thể tải lên hình ảnh đơn lẻ hoặc tài liệu PDF. Đối với PDF, ứng dụng cho phép duyệt từng trang và nhận diện trang đang chọn.
- **Trình bày Văn bản Dọc (Vertical Text)**: Phần nguyên văn chữ Hán được trình bày theo cột dọc, có kẻ ô giấy bản và đánh số dòng rõ ràng để dễ đối chiếu.
- **Phiên âm Hán Việt**: Tự động cung cấp âm đọc Hán Việt kèm theo các chỉ số dòng [N] tương ứng để theo dõi nội dung.
- **Dịch nghĩa Hiện đại**: Cung cấp bản dịch tiếng Việt hiện đại trôi chảy dưới dạng đoạn văn.
- **Giao diện Song song (Split-view)**: Bố cục cố định nguồn tài liệu bên trái và kết quả phân tích bên phải, giúp tối ưu hóa việc theo dõi nội dung khi cuộn trang.
- **Đa ngôn ngữ**: Hỗ trợ giao diện tiếng Việt và tiếng Nhật.

## Giải thích chi tiết về các Công nghệ & Kỹ thuật

### 1. Trí tuệ nhân tạo (Gemini API - Multimodal Large Language Model)
- **Mô hình xử lý**: Ứng dụng sử dụng dòng mô hình **Gemini 1.5 Pro/Flash**, vốn là các mô hình đa phương thức (multimodal). Điều này cho phép gửi trực tiếp dữ liệu hình ảnh (base64) cùng với các chỉ thị (prompt) phức tạp.
- **Kỹ thuật OCR & Phân tích**: Thay vì chỉ nhận diện ký tự rời rạc, AI được giao nhiệm vụ phân tích cấu trúc văn bản. AI phải hiểu được ngữ cảnh của các chữ Hán Nôm (vốn có nhiều dị thể) để đưa ra phiên âm chính xác nhất.
- **Prompt Engineering**: Hệ thống sử dụng các chỉ thị hệ thống (system instructions) nghiêm ngặt để đảm bảo đầu ra là định dạng JSON chuẩn, giúp giao diện React có thể bóc tách dữ liệu (văn bản dọc, phiên âm, dịch nghĩa) một cách chính xác.

### 2. Xử lý tài liệu PDF (PDF.js)
- **Cơ chế render**: Sử dụng thư viện `pdfjs-dist` của Mozilla. Kỹ thuật này không chỉ đơn thuần là mở tệp PDF mà là render từng trang của tài liệu lên một `HTML5 Canvas`.
- **Chuyển đổi dữ liệu**: Sau khi render lên Canvas, trang PDF được xuất ra định dạng `dataURL` (JPEG/PNG) để AI có thể "nhìn" thấy và xử lý như một hình ảnh thông thường.
- **Quản lý tài nguyên**: Sử dụng các Web Workers của PDF.js để đảm bảo việc xử lý các tệp PDF nặng không gây treo giao diện người dùng (Main Thread).

### 3. Trình bày văn bản dọc (CSS Writing Mode & Layout)
- **Writing Mode**: Sử dụng thuộc tính `writing-mode: vertical-rl`. Đây là kỹ thuật quan trọng nhất để trình bày văn bản theo phong cách Đông Á truyền thống (Dọc - Từ phải sang trái).
- **Manuscript Grid**: Các đường kẻ ô được tạo bằng `linear-gradient` trong CSS, giúp tạo ra các cột thẳng hàng mà không cần sử dụng các thẻ HTML phức tạp cho từng ô chữ, giúp tăng hiệu năng hiển thị.
- **Responsive Mixed Layout**: Sử dụng `flex-direction: row-reverse` cho container chính của phần nguyên văn để đảm bảo cột số 1 nằm bên phải và các cột tiếp theo phát triển dần sang bên trái.

### 4. Giao diện & Trải nghiệm (React & Tailwind)
- **State Management**: Sử dụng React Hooks (`useState`, `useRef`, `useEffect`) để quản lý luồng dữ liệu từ khi tải tệp lên, render trang PDF, gọi API cho đến khi hiển thị kết quả.
- **Bố cục Sticky & Scroll**: Áp dụng kỹ thuật `sticky positioning` để cố định nguồn tài liệu bên trái. Điều này đòi hỏi tính toán kỹ về `height: 100vh` và `overflow` để đảm bảo trải nghiệm cuộn mượt mà trên cả desktop và mobile.
- **Antialiasing & Typography**: Chữ Hán được tối ưu hóa hiển thị với `-webkit-font-smoothing: antialiased` và font chữ `Noto Serif TC` để các nét chữ sắc nét, giống như được in từ bản khắc gỗ cổ.

### 5. Diễn đạt âm đọc và dịch thuật
- **Sino-Vietnamese Parsing**: Kết quả từ AI trả về các dấu mốc dòng (line markers) dạng `[N]`. Hệ thống frontend sử dụng Regular Expressions (`RegExp`) để bóc tách các mốc này và gắn styles riêng (màu đỏ niêm ấn, font chữ mono) để làm nổi bật vị trí bắt đầu của mỗi dòng.

## Hướng dẫn sử dụng
1. **Tải lên tài liệu**: Nhấp vào khu vực tải lên hoặc kéo thả tệp Hình ảnh (JPG, PNG) hoặc PDF vào ứng dụng.
2. **Duyệt trang (đối với PDF)**: Sử dụng các nút điều hướng để chọn trang văn bản cần nhận diện.
3. **Thực hiện nhận diện**: Nhấn nút "Chạy hệ thống Neural" (hoặc "Nhận diện trang này") để bắt đầu quá trình OCR và dịch thuật.
4. **Theo dõi kết quả**:
   - **Bên trái**: Xem văn bản gốc (đã được phóng to/thu nhỏ phù hợp).
   - **Bên phải**: Xem kết quả OCR theo chiều dọc, âm Hán Việt và bản dịch.
5. **Số dòng**: Đối chiếu các số hiệu [1], [2]... trên bản phiên âm với các cột chữ Hán để xác định vị trí chính xác của ký tự.

## Giải thích kỹ thuật về Bố cục
- **Fixed Source Panel**: Phần hiển thị tài liệu gốc được thiết kế `sticky` (cố định) ở bên trái giao diện máy tính để khi người dùng cuộn xem bản dịch dài ở bên phải, hình ảnh gốc vẫn luôn nằm trong tầm mắt.
- **Manuscript Grid**: Sử dụng CSS Gradient để mô phỏng các đường kẻ ô đỏ truyền thống trên nền giấy xuyến chỉ, mang lại cảm giác hoài cổ và đúng chuẩn văn hiến.
- **Vertical Writing Mode**: Sử dụng thuộc tính `writing-mode: vertical-rl` kết hợp với cấu trúc Flexbox để trình bày chữ Hán đúng quy cách từ trên xuống dưới và từ phải sang trái.

## Bảo mật & API
Ứng dụng sử dụng API Key của Gemini được quản lý thông qua biến môi trường. Lưu ý bảo mật API Key này khi triển khai thực tế. (Mặc định trong môi trường AI Studio, key đã được thiết lập sẵn).

---
*Dự án này được xây dựng như một công cụ hỗ trợ cho các nhà nghiên cứu, sinh viên và những người yêu thích văn hóa Hán Nôm.*
