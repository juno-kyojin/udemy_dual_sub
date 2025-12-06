# Udemy Dual Subtitles 🎓

[English](#english) | [Tiếng Việt](#tiếng-việt)

---

## English

A Chrome extension that automatically translates Udemy subtitles to Vietnamese and displays them alongside the original subtitles.

### ✨ Features

- **Dual Subtitle Display**: Shows both original and translated subtitles simultaneously
- **Real-time Translation**: Automatically translates subtitles as they appear using Google Translate API
- **Customizable Styling**: 
  - Adjust font size, color, and weight
  - Control opacity and background color
  - Personalize the viewing experience
- **Easy Toggle**: Turn the extension on/off with a single click
- **Auto-sync**: Subtitles stay synchronized even when seeking through the video
- **Non-intrusive**: Original Udemy interface remains unchanged

### 📦 Installation

#### Method 1: Install from Chrome Web Store
*Coming soon - Extension pending publication*

#### Method 2: Install Manually (Developer Mode)

1. **Download the Extension**
   ```bash
   git clone https://github.com/YOUR_USERNAME/udemy_dual_sub.git
   ```
   Or download as ZIP and extract

2. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or click Menu (⋮) → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle "Developer mode" switch in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the `udemydualsub` folder you downloaded
   - The extension icon should appear in your toolbar

### 🚀 Usage

1. **Navigate to Udemy**
   - Open any Udemy course with video lectures
   - Make sure subtitles are enabled on the video player

2. **Activate the Extension**
   - Click the extension icon in your Chrome toolbar
   - Toggle "Bật phụ đề song ngữ" (Enable dual subtitles) to ON
   - The switch will turn purple when active

3. **Watch with Dual Subtitles**
   - Original subtitles appear on top
   - Vietnamese translation appears below
   - Translations update automatically as the video plays

4. **Customize (Optional)**
   - Click the extension icon
   - Navigate to "CÀI ĐẶT NÂNG CAO" (Advanced Settings)
   - Adjust:
     - **Font Color**: Choose your preferred text color
     - **Font Weight**: Light, Normal, or Bold
     - **Font Size**: 12px to 40px
     - **Opacity**: 0% to 100%
     - **Background Color**: Adjust subtitle background

### ⚙️ Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| Font Color | Color of translated text | Yellow (#ffeb3b) |
| Font Weight | Text thickness (Light/Normal/Bold) | Normal (700) |
| Font Size | Size of translated text | 20px |
| Opacity | Transparency of translated text | 100% |
| Background Color | Background behind translated text | Black (#000000) |

### 🔧 Technical Details

**Built with:**
- Chrome Extension Manifest V3
- Vanilla JavaScript
- Google Translate API
- Chrome Storage API

**Permissions Required:**
- `activeTab`: To interact with Udemy video pages
- `scripting`: To inject subtitle overlay
- `storage`: To save user preferences
- Host permissions for `udemy.com` and `translate.googleapis.com`

**File Structure:**
```
udemydualsub/
├── manifest.json          # Extension configuration
├── icons/                 # Extension icons
├── src/
│   ├── background.js      # Background service worker (handles translations)
│   ├── content.js         # Content script (observes and displays subtitles)
│   ├── styles.css         # Custom styles for subtitle overlay
│   └── popup/
│       ├── popup.html     # Extension popup UI
│       └── popup.js       # Popup logic and settings
└── README.md
```

### 🐛 Troubleshooting

**Subtitles not appearing?**
- Ensure Udemy subtitles/captions are enabled on the video player
- Refresh the page after enabling the extension
- Check that the extension is turned ON in the popup

**Translation not working?**
- Check your internet connection
- Google Translate API must be accessible
- Try refreshing the page

**Subtitles out of sync after seeking?**
- The extension automatically re-syncs when you skip through the video
- If issues persist, try pausing and resuming the video

### 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

### 👨‍💻 Author

Created with ❤️ for Udemy learners

---

## Tiếng Việt

Extension Chrome tự động dịch phụ đề Udemy sang tiếng Việt và hiển thị song song với phụ đề gốc.

### ✨ Tính năng

- **Hiển thị phụ đề kép**: Hiển thị đồng thời phụ đề gốc và bản dịch
- **Dịch tức thời**: Tự động dịch phụ đề khi chúng xuất hiện bằng Google Translate API
- **Tùy chỉnh giao diện**:
  - Điều chỉnh kích thước, màu sắc và độ đậm chữ
  - Kiểm soát độ mờ và màu nền
  - Cá nhân hóa trải nghiệm xem
- **Bật/tắt dễ dàng**: Bật tắt extension chỉ với một cú nhấp chuột
- **Tự động đồng bộ**: Phụ đề luôn đồng bộ ngay cả khi tua video
- **Không xâm phạm**: Giao diện Udemy gốc không bị thay đổi

### 📦 Cài đặt

#### Phương pháp 1: Cài đặt từ Chrome Web Store
*Sắp ra mắt - Extension đang chờ phê duyệt*

#### Phương pháp 2: Cài đặt thủ công (Chế độ Developer)

1. **Tải Extension**
   ```bash
   git clone https://github.com/YOUR_USERNAME/udemy_dual_sub.git
   ```
   Hoặc tải file ZIP và giải nén

2. **Mở trang Extensions của Chrome**
   - Truy cập `chrome://extensions/`
   - Hoặc nhấp Menu (⋮) → Tiện ích mở rộng khác → Tiện ích mở rộng

3. **Bật chế độ Developer**
   - Bật công tắc "Chế độ nhà phát triển" ở góc trên bên phải

4. **Tải Extension**
   - Nhấp "Tải tiện ích mở rộng đã giải nén"
   - Chọn thư mục `udemydualsub` bạn vừa tải về
   - Icon extension sẽ xuất hiện trên thanh công cụ

### 🚀 Sử dụng

1. **Truy cập Udemy**
   - Mở bất kỳ khóa học Udemy nào có video bài giảng
   - Đảm bảo phụ đề đã được bật trên trình phát video

2. **Kích hoạt Extension**
   - Nhấp vào icon extension trên thanh công cụ Chrome
   - Bật công tắc "Bật phụ đề song ngữ" lên ON
   - Công tắc sẽ chuyển sang màu tím khi đang hoạt động

3. **Xem với phụ đề kép**
   - Phụ đề gốc xuất hiện ở trên
   - Bản dịch tiếng Việt xuất hiện ở dưới
   - Bản dịch tự động cập nhật khi video phát

4. **Tùy chỉnh (Tùy chọn)**
   - Nhấp vào icon extension
   - Chuyển sang tab "CÀI ĐẶT NÂNG CAO"
   - Điều chỉnh:
     - **Màu chữ**: Chọn màu chữ bạn thích
     - **Độ đậm chữ**: Nhẹ, Thường, hoặc Đậm
     - **Kích thước chữ**: Từ 12px đến 40px
     - **Độ mờ**: Từ 0% đến 100%
     - **Màu nền**: Điều chỉnh màu nền phụ đề

### ⚙️ Tùy chọn cấu hình

| Cài đặt | Mô tả | Mặc định |
|---------|-------|----------|
| Màu chữ | Màu của văn bản đã dịch | Vàng (#ffeb3b) |
| Độ đậm chữ | Độ đậm của văn bản (Nhẹ/Thường/Đậm) | Thường (700) |
| Kích thước chữ | Kích thước văn bản đã dịch | 20px |
| Độ mờ | Độ trong suốt của văn bản đã dịch | 100% |
| Màu nền | Màu nền phía sau văn bản đã dịch | Đen (#000000) |

### 🔧 Chi tiết kỹ thuật

**Xây dựng bằng:**
- Chrome Extension Manifest V3
- Vanilla JavaScript
- Google Translate API
- Chrome Storage API

**Quyền yêu cầu:**
- `activeTab`: Để tương tác với trang video Udemy
- `scripting`: Để chèn lớp phủ phụ đề
- `storage`: Để lưu tùy chọn người dùng
- Quyền truy cập host cho `udemy.com` và `translate.googleapis.com`

**Cấu trúc file:**
```
udemydualsub/
├── manifest.json          # Cấu hình extension
├── icons/                 # Icon extension
├── src/
│   ├── background.js      # Service worker nền (xử lý dịch thuật)
│   ├── content.js         # Content script (quan sát và hiển thị phụ đề)
│   ├── styles.css         # Style tùy chỉnh cho lớp phủ phụ đề
│   └── popup/
│       ├── popup.html     # Giao diện popup extension
│       └── popup.js       # Logic popup và cài đặt
└── README.md
```

### 🐛 Khắc phục sự cố

**Phụ đề không hiển thị?**
- Đảm bảo phụ đề/caption Udemy đã được bật trên trình phát video
- Làm mới trang sau khi bật extension
- Kiểm tra rằng extension đã được BẬT trong popup

**Dịch thuật không hoạt động?**
- Kiểm tra kết nối internet
- Google Translate API phải có thể truy cập được
- Thử làm mới trang

**Phụ đề không đồng bộ sau khi tua?**
- Extension tự động đồng bộ lại khi bạn tua video
- Nếu vấn đề vẫn tiếp diễn, thử tạm dừng và tiếp tục video

### 📝 Giấy phép

Dự án này được cấp phép theo Giấy phép MIT - xem file [LICENSE](LICENSE) để biết chi tiết.

### 🤝 Đóng góp

Rất hoan nghênh các đóng góp! Hãy thoải mái:
- Báo cáo lỗi
- Đề xuất tính năng mới
- Gửi pull request

### 👨‍💻 Tác giả

Tạo ra với ❤️ dành cho những người học Udemy