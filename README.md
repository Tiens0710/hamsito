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

English Coach có hai giao diện dùng chung hồ sơ: Zalo và web **Nói**. Hồ sơ lưu mục tiêu,
thời lượng, các lỗi có dẫn chứng từ câu đã gửi và mẫu câu thực sự dùng trong hội thoại.
Trợ lý lấy ngữ cảnh này ở buổi sau để gợi dùng lại các câu cần ôn. Không kết luận điểm yếu
khi chưa có dữ liệu, không chấm phát âm từ tin nhắn chữ.

### Mở bản web

```bash
npm install
npm run web
```

Mở `http://127.0.0.1:3210`. Bản web có tổng quan, luyện hội thoại, 10 tình huống giao tiếp,
lộ trình theo mục tiêu, sổ tay ôn câu và thiết lập. `npm run web` chỉ mở web, không đăng nhập Zalo.
`npm start` mở cả web lẫn bot trong cùng tiến trình, dùng chung hàng đợi xử lý và dữ liệu.
Dừng bản web độc lập trước khi dùng `npm start`, vì hai chế độ sử dụng cùng một cổng.
Có thể đổi `ENGLISH_WEB_PORT`, hoặc đặt `ENGLISH_WEB_ENABLED=false` để chạy riêng bot.
Bản chạy cục bộ chỉ lắng nghe ở localhost; bản online được phục vụ qua Vercel.

### Triển khai bản web lên Vercel

Vercel phục vụ giao diện tĩnh và API Node.js trong `api/`. Tiến độ và lịch sử luyện tiếng Anh được lưu trong Supabase để không phụ thuộc filesystem tạm của function; bot Zalo và web dùng cùng các biến `SUPABASE_URL` và `SUPABASE_SECRET_KEY` ở môi trường máy chủ. Chạy nội dung `supabase/migrations/20261022000100_english_coach.sql` một lần trong SQL Editor của Supabase trước khi mở app.

Trong Vercel, đặt `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ENGLISH_WEB_ACCESS_PASSWORD` và `ENGLISH_WEB_SESSION_SECRET` cho Production. Tạo session secret ngẫu nhiên tối thiểu 32 ký tự. Mật khẩu web bảo vệ trang và các API gọi Gemini; cookie đăng nhập được ký, HttpOnly, SameSite=Strict và Secure. Chỉ giữ khóa Supabase/Gemini ở biến môi trường server-side, không đặt tiền tố `NEXT_PUBLIC_` và không đưa vào mã frontend. Thêm cùng hai biến Supabase vào `.env` của máy chạy bot để đồng bộ dữ liệu Zalo; khi cấu hình, `/english web` tạo mã ghép nối một lần và web dùng mã đó để mở đúng hồ sơ.

Để dùng AI cần thêm `GEMINI_API_KEY` hợp lệ vào `.env`, rồi khởi động lại tiến trình đang chạy.
Khóa được giữ ở máy chủ. Nếu thiếu khóa hoặc API lỗi, trang hiển thị thông báo; không giả lập
phản hồi AI hay tạo sẵn điểm số. Chọn mức A1–C1 trong thiết lập là tự chọn mức luyện, không
phải chứng nhận trình độ. Tiến độ “đã luyện” là số lượt tương tác, không đo độ thành thạo.

Nút nghe dùng giọng đọc của trình duyệt. Micro dùng SpeechRecognition nếu trình duyệt hỗ trợ,
chuyển tiếng Anh thành chữ để người học xem lại trước khi gửi; không tự gửi bản nhận diện.
Chrome/Edge hỗ trợ tùy máy và dịch vụ nhận diện có thể cần mạng. Chưa có đánh giá phát âm,
hội thoại âm thanh trực tiếp hay Gemini Live trong tính năng này.

### Nối hồ sơ Zalo và web

Nhắn `/english web` cho bot trong DM, rồi mở **Thiết lập → Web + Zalo** và nhập mã 8 ký tự.
Mã hết hạn sau 10 phút và chỉ dùng được một lần. Khi nối, web chuyển sang đúng hồ sơ Zalo;
hồ sơ web riêng vẫn được giữ và có thể quay lại bằng nút **Về hồ sơ web riêng**.
Cookie được ký, HttpOnly và SameSite=Strict; API không nhận UID tùy ý từ giao diện.
Các file hồ sơ, cookie secret và mã kết nối nằm trong `data/`, đã được Git bỏ qua.

### Lộ trình và ôn câu cá nhân

```text
/english goal Giao tiếp công việc và trao đổi với đồng nghiệp
/english time 15
/english plan
/english today
/english cards
/english card show
/english card good
/english card again
```

`today` chọn tình huống tiếp theo dựa trên mục tiêu và lượt đã luyện. Sau hội thoại, trợ lý
lưu tối đa một lỗi có trích dẫn từ câu của người học và hai mẫu câu vừa dùng. `cards` gợi ý
nghĩa tiếng Việt để tự nhớ lại; `card show` hiện câu tham khảo. Người học tự đánh dấu đã nhớ
hoặc cần ôn: câu đã nhớ quay lại sau 1, 3, 7, 14, 30 ngày; chưa nhớ được ôn lại sau 10 phút.

### Các lệnh luyện hội thoại

```text
/english start cafe
/english hint
/english explain
/english example
/english repeat
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

Sau `/english start cafe`, bạn là khách gọi món, bot là nhân viên quán cà phê. Mục tiêu là tự
gọi đồ uống, đưa yêu cầu riêng, hỏi giá và thanh toán. Bot đáp lại điều bạn vừa nói và chỉ đưa
một câu hỏi tiếp; mỗi lượt sửa tối đa một điểm quan trọng rồi tiếp tục tình huống. Bạn có thể
trả lời bằng tiếng Việt khi bí để được giúp diễn đạt ý đó bằng tiếng Anh.

Nhắn “gợi ý” hoặc `/english hint` để nhận một cụm từ và khung câu có chỗ trống. Nhắn
“không hiểu” hoặc `/english explain` để giải thích câu vừa rồi bằng tiếng Việt;
`/english example` cho một câu mẫu để bạn tự thay chi tiết, `/english repeat` nhắc lại bằng
câu dễ hơn. Các yêu cầu hỗ trợ không được tính là lượt luyện, không cộng XP và không thay
đổi hội thoại đang chờ bạn trả lời. Bot luyện qua tin nhắn, không chấm phát âm.

Mỗi buổi luyện mới có lịch sử riêng và lưu câu mở đầu, tránh lẫn tình huống hoặc hỏi lại
câu chào. Có thể dùng tên chủ đề tiếng Việt, như `/english start công việc`,
`/english lesson du lịch` hoặc `/english start hỏi đường`. Tiến độ được lưu
trong `data/english-coach/`; lịch sử hội thoại được tách riêng trong thư mục `HISTORY_DIR`.

`/english daily` bật chế độ học từ vựng hằng ngày: bot tạo 5 từ mới liên quan đến bài trước,
đưa nghĩa, ví dụ, word bank và một đoạn văn có 5 chỗ trống. Dùng `/english answer từ_1, từ_2, ...`
để nộp bài. Mặc định bot gửi lúc 07:30 theo `TZ`; có thể đổi giờ bằng `/english daily time 20:00`.

Cách dùng nhanh: `/english lesson cafe` → tự trả lời bằng tiếng Anh → bí thì nhắn “gợi ý”
→ tiếp tục xử lý tình huống → `/english review` để ôn câu đã dùng.

`/english lesson` bắt đầu buổi luyện có hướng dẫn. Sau 8 lượt trả lời, bot ôn nhanh tối đa
2 mẫu câu và 1 điểm cần cải thiện từ hội thoại thực tế, rồi tiếp tục trò chuyện cùng tình huống.
Buổi học không tự chuyển sang trắc nghiệm; dùng `/english quiz` khi chủ động muốn làm bài.
`/english start` hoặc `/english roleplay` là hội thoại mở. `/english stop` kết thúc buổi luyện.
XP vẫn được lưu để xem trong báo cáo, không xuất hiện sau mỗi câu trả lời.
Dùng /english game hoặc /english report để xem XP, level, streak, thành tựu và 3 session gần nhất.
Mỗi người dùng có file tiến độ riêng theo UID Zalo, gồm nhật ký session, nên XP, quiz và lịch sử AI
không bị trộn giữa các tài khoản.

### Từ vựng trên web

Mở mục **Từ vựng** (`#vocabulary`) để học các bộ từ giao tiếp. Bản hiện tại có 40 bộ
với 300 mục từ; nội dung được biên soạn riêng cho Nói.

- Thẻ từ có nghĩa, phiên âm, từ loại, ví dụ và bản dịch; hỗ trợ lật thẻ, đánh dấu sao,
  lọc từ chưa nhớ/đến hạn và xáo trộn.
- Luyện nhớ bằng cách gõ từ tiếng Anh từ nghĩa tiếng Việt hoặc chọn trong 4 đáp án.
- Bài đọc dùng lại từ trong bộ: điền trực tiếp trong đoạn, gợi nghĩa tùy chọn, ngân hàng
  từ, nghe/dịch từng câu và câu hỏi hiểu nội dung. Máy chủ chấm bài và lưu lịch sử.
- Nghe chép từng từ hoặc cả câu ví dụ bằng giọng tiếng Anh có sẵn trong trình duyệt;
  có tốc độ đọc và phím Ctrl/Command + Enter để nghe lại. Không chấm điểm phát âm.
- Nút **Luyện nói bộ từ này** mở đúng tình huống và đưa bộ từ vào ngữ cảnh của trợ lý.

Tiến độ và bài đọc đang làm được lưu trong `learning.vocabulary` của hồ sơ hiện có,
bao gồm Supabase khi đã cấu hình. Không cần migration hoặc biến môi trường mới.
Các thao tác dùng `POST /api/vocabulary`, cùng cơ chế xác thực và kiểm tra Origin
của ứng dụng. Đáp án được chấm tại máy chủ; ký tự hoa và dấu câu không ảnh hưởng kết quả.

Ví dụ đường dẫn: `?set=cafe&mode=reading#vocabulary`. Ngoài các bài biên soạn sẵn,
trong **Tuỳ chọn** của bài đọc có thể chọn mức A1–C1 và tạo bài mới bằng Gemini.
Máy chủ kiểm tra cấu trúc, đủ 8 từ đúng trong bộ, và lưu tối đa 10 bài AI cho mỗi bộ.
Nếu AI trả nội dung không hợp lệ, bài mới sẽ không được lưu và ứng dụng báo để thử lại.

## License

MIT
