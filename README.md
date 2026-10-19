# Zalo AI Bot - Gemini Version

A simple AI chatbot for Zalo using [zca-js](https://www.npmjs.com/package/zca-js) and Gemini through its OpenAI-compatible endpoint.

## Features

- Login to Zalo via QR code (session saved automatically)
- Listen for incoming messages
- Respond to direct messages and group messages starting with `@bot` (or a configured alias)
- AI-powered responses via Gemini (OpenAI-compatible endpoint)
- Long-term memory for explicitly saved user preferences
- Image understanding, web research, reminders, translation, stickers and voice replies
- English Coach for conversational English practice
- Error handling and logging

## Prerequisites

- Node.js 20+
- A Zalo account (recommended: use a separate account, not your personal one)
- Gemini API key

## Project Structure

```
zalo-ai-bot/
├── bot.mjs          # Main bot application
├── .env.example     # Environment variable template
├── package.json     # Project configuration
└── README.md        # This file
```

## Installation

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Edit `.env` with your Gemini credentials:

```
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_VISION_MODEL=gemini-3.1-flash-lite
GEMINI_MAX_TOKENS=420

# Nên tắt các tính năng tự động khi mới triển khai
REACTION_ON_GROUP_ALL=false
AUTO_STICKER_ENABLED=false
AUTO_FRIEND_REQUEST_ENABLED=false

# UID Zalo được phép dùng /bot on|off|status
ADMIN_UIDS=YOUR_ZALO_UID

# Cấu hình SMTP để dùng lệnh gửi email (Gmail cần App Password)
MAIL_SMTP_HOST=smtp.gmail.com
MAIL_SMTP_PORT=587
MAIL_SMTP_SECURE=false
MAIL_SMTP_USER=your-email@gmail.com
MAIL_SMTP_PASSWORD=your-app-password
MAIL_FROM=your-email@gmail.com

# Có thể bật nếu muốn bot tự gửi lời mời kết bạn khi có người nhắn DM
AUTO_FRIEND_REQUEST_MESSAGE=Chào bạn, mình kết bạn nhé!

# Tự research câu hỏi cần thông tin mới (lấy key tại tavily.com)
RESEARCH_ENABLED=true
TAVILY_API_KEY=YOUR_TAVILY_API_KEY
RESEARCH_MAX_RESULTS=3

# Memory dài hạn — chỉ lưu thông tin người dùng nói rõ muốn ghi nhớ
MEMORY_ENABLED=true
MEMORY_DIR=./data/memory
MEMORY_MAX_ITEMS=24
MEMORY_RETRIEVE_COUNT=8

# Giới hạn spam và tối ưu chi phí/API
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=3500
MAX_QUESTION_LENGTH=4000
RUNTIME_CACHE_TTL_MS=1800000
RESEARCH_CACHE_TTL_MS=900000

# English Coach — luyện giao tiếp bằng Gemini trong DM
ENGLISH_COACH_ENABLED=true
ENGLISH_COACH_DIR=./data/english-coach
ENGLISH_DEFAULT_LEVEL=A2
# Giờ mặc định gửi bài từ vựng; không bắt buộc, có thể đổi bằng lệnh trong bot
DAILY_VOCAB_HOUR=7
DAILY_VOCAB_MINUTE=30
```

Danh sách người đã được xử lý được lưu tại `data/auto-friend-requests.json`, vì vậy bot không gửi lặp lời mời cho cùng một người. Chỉ bật `AUTO_FRIEND_REQUEST_ENABLED=true` nếu bạn thực sự muốn bot tự gửi lời mời.
Bot sẽ tự research khi câu hỏi có dấu hiệu cần dữ liệu mới như tin tức, giá, thời tiết, tỷ giá, lịch, review hoặc “cập nhật”. Không có `TAVILY_API_KEY` thì bot vẫn chạy nhưng bỏ qua bước research.
Quản trị viên có thể gửi email bằng lệnh `/mail email@example.com | Tiêu đề | Nội dung`. Lệnh này yêu cầu SMTP được cấu hình và UID người gửi có trong `ADMIN_UIDS`.

English Coach được thiết kế theo các mức CEFR và các tình huống speaking đời thường. Nội dung tham khảo từ [British Council Speaking](https://learnenglish.britishcouncil.org/free-resources/speaking) và [Cambridge English activities](https://www.cambridgeenglish.org/learning-english/activities-for-learners/?skill=speaking), nhưng bot tự tạo hội thoại mới thay vì sao chép bài trên web.

## Usage

```bash
npm start
```

1. A QR code will appear in the terminal
2. Scan the QR code with the Zalo app on your phone
3. The bot will log in and start listening for messages
4. Send a DM, or send a group message starting with `@bot` / `@hamsito`, to interact with the AI

## Example Conversation

**User:**
```
@bot hello
```

**Bot:**
```
Hello! How can I help you today?
```

**User:**
```
@bot hôm nay thời tiết thế nào
```

**Bot:**
```
Xin lỗi, tôi không có khả năng truy cập dữ liệu thời tiết thời gian thực...
```

## How It Works

1. User sends a message in Zalo
2. zca-js receives the message
3. The bot extracts the message, relevant memory and optional research context
4. The current turn is sent to Gemini through its OpenAI-compatible API
5. The AI response is sent back to the same Zalo chat

## ⚠️ Important Warning

**zca-js is NOT an official Zalo API.** Using it may result in:

- Account logout
- CAPTCHA verification
- Temporary account restrictions

**Recommendation:** Use a separate Zalo account for the bot. Do not use your personal account.

## Memory commands (DM)

```text
/remember Sen thích cà phê sữa đá
/memory
/forget 1
```

Bot chỉ tự động ghi nhớ những thông tin được nói rõ theo dạng như “tôi tên là…”,
“gọi tôi là…”, “tôi thích…” hoặc “nhớ rằng…”. Dữ liệu được lưu trong `data/memory/`.
Lịch sử cũ được nén thành context digest để giảm kích thước prompt; cache runtime cũng
được tự động dọn sau thời gian không hoạt động.

## English Coach (DM)

```text
/english start cafe
/english daily
/english vocab
/english answer order, menu, ...
/english daily time 07:30
/english daily off
/english lesson
/english lesson cafe
/english quiz
/english answer A
/english roleplay cafe
/english test
/english topic
/english level B1
/english review
/english report
/english game
/english achievements
/english stop
```

Sau `/english start`, mọi tin nhắn DM thông thường sẽ được xem là lượt trả lời của người học.
Bot giữ vai diễn, sửa lỗi quan trọng, gợi ý cách nói tự nhiên và hỏi tiếp một câu. Tiến độ được lưu
trong `data/english-coach/`; lịch sử hội thoại được tách riêng trong thư mục `HISTORY_DIR`.

`/english daily` bật chế độ học từ vựng hằng ngày: bot tạo 5 từ mới liên quan đến bài trước,
đưa nghĩa, ví dụ, word bank và một đoạn văn có 5 chỗ trống. Dùng `/english answer từ_1, từ_2, ...`
để nộp bài. Mặc định bot gửi lúc 07:30 theo `TZ`; có thể đổi giờ bằng `/english daily time 20:00`.

Cách dùng nhanh: /english lesson cafe → trả lời bằng tiếng Anh → chọn A/B/C khi bot ra mini-test
→ dùng /english game để xem điểm và thành tựu.

/english lesson bắt đầu một bài học 5 lượt. Sau khi hoàn thành, bot tự mở mini-test 3 câu
của đúng chủ đề đó; dùng /english quiz nếu muốn mở lại bài test. Mỗi câu đúng được cộng XP;
điểm tuyệt đối sẽ mở thêm thành tựu.
Dùng /english game hoặc /english report để xem XP, level, streak, thành tựu và 3 session gần nhất.
Mỗi người dùng có file tiến độ riêng theo UID Zalo, gồm nhật ký session, nên XP, quiz và lịch sử AI
không bị trộn giữa các tài khoản.

## License

MIT
