# Zalo AI Bot - MiMo API Version

A simple AI chatbot for Zalo using [zca-js](https://www.npmjs.com/package/zca-js) and Xiaomi MiMo API.

## Features

- Login to Zalo via QR code (session saved automatically)
- Listen for incoming messages
- Respond only to messages starting with `@bot`
- AI-powered responses via Xiaomi MiMo API (OpenAI-compatible)
- Error handling and logging

## Prerequisites

- Node.js 20+
- A Zalo account (recommended: use a separate account, not your personal one)
- MiMo API key

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

2. Edit `.env` with your MiMo API credentials:

```
MIMO_API_KEY=YOUR_MIMO_API_KEY
MIMO_BASE_URL=https://api.mimo.com/v1
MIMO_MODEL=mimo-v2-5
```

## Usage

```bash
npm start
```

1. A QR code will appear in the terminal
2. Scan the QR code with the Zalo app on your phone
3. The bot will log in and start listening for messages
4. Send a message starting with `@bot` to interact with the AI

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
3. If the message starts with `@bot`, the text after `@bot` is sent to MiMo API
4. The AI response is sent back to the same Zalo chat

## ⚠️ Important Warning

**zca-js is NOT an official Zalo API.** Using it may result in:

- Account logout
- CAPTCHA verification
- Temporary account restrictions

**Recommendation:** Use a separate Zalo account for the bot. Do not use your personal account.

## Future Features (Optional)

- Conversation memory
- SQLite database storage
- Image understanding
- Voice message support
- Web search integration
- Admin commands
- Anti-spam protection
- Docker deployment

## License

MIT