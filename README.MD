# WhatsApp Gateway

A self-hosted, multi-device WhatsApp API gateway similar to WaSenderAPI.  
Scan multiple QR codes, configure per-account webhooks, and send messages via a simple REST API.

---

## Features

| Feature | Details |
|---|---|
| Multiple devices | Each "Account" runs its own WhatsApp client |
| Session persistence | Sessions survive server restarts via `LocalAuth` (stored on disk) |
| Dashboard | Dark UI: QR scanner, status, live message feed, webhook logs |
| Inbound webhooks | Configurable POST URL per account, retried up to 3× on failure |
| Outbound API | Text, Image, Document, Buttons, List messages |
| Auth | Per-account `X-API-Key` header |
| Database | SQLite via `better-sqlite3` |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and edit environment file
cp .env.example .env

# 3. Start
npm start
# or for development with auto-reload:
npm run dev
```

Open **http://localhost:3000** in your browser.
Production: http://137.184.166.160:3011/ (check pass manager for access)
---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `DB_PATH` | `./data/gateway.db` | SQLite database file path |
| `SESSIONS_PATH` | `./sessions` | WhatsApp session storage directory |

---

## Dashboard

1. Click **＋ Add Account** — enter a name and optional webhook URL
2. A QR code will appear — scan it with WhatsApp (Linked Devices → Link a Device)
3. Once connected the status turns green
4. Your **API Key** is shown only at creation — copy it immediately (or store it)

---

## REST API

All message-sending endpoints require the `X-API-Key` header.

### Accounts

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/accounts` | List all accounts |
| `POST` | `/api/accounts` | Create account |
| `GET` | `/api/accounts/:id` | Get account + status |
| `PUT` | `/api/accounts/:id` | Update name / phone / webhook_url |
| `DELETE` | `/api/accounts/:id` | Delete account + stop client |
| `GET` | `/api/accounts/:id/qr` | Get QR data URL |
| `POST` | `/api/accounts/:id/restart` | Restart WA client |
| `GET` | `/api/accounts/:id/logs` | Webhook delivery logs |

### Messages

All require `X-API-Key: <account_api_key>` header.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/accounts/:id/messages` | Send a message (JSON) |
| `POST` | `/api/accounts/:id/messages/media` | Send media (multipart/form-data) |
| `GET` | `/api/accounts/:id/messages` | Message history |

---

## Send Message Examples

### Text
```http
POST /api/accounts/{accountId}/messages
X-API-Key: wg_your_key_here
Content-Type: application/json

{
  "to": "5491155551234",
  "type": "text",
  "text": "Hello from the gateway!"
}
```

### Image (URL)
```json
{
  "to": "5491155551234",
  "type": "image",
  "url": "https://example.com/photo.jpg",
  "caption": "Check this out"
}
```

### Document (URL)
```json
{
  "to": "5491155551234",
  "type": "document",
  "url": "https://example.com/report.pdf",
  "filename": "Q3-Report.pdf",
  "caption": "Monthly report"
}
```

### Buttons
```json
{
  "to": "5491155551234",
  "type": "buttons",
  "body": "What do you need?",
  "buttons": [
    { "text": "Support" },
    { "text": "Sales" },
    { "text": "Billing" }
  ],
  "footer": "We'll reply shortly"
}
```

### List
```json
{
  "to": "5491155551234",
  "type": "list",
  "body": "Pick an option",
  "buttonText": "Open Menu",
  "sections": [
    {
      "title": "Services",
      "rows": [
        { "id": "s1", "title": "Technical Support", "description": "Bug reports & help" },
        { "id": "s2", "title": "Sales", "description": "New subscriptions" }
      ]
    }
  ]
}
```

### Media upload (multipart)
```bash
curl -X POST http://localhost:3000/api/accounts/{id}/messages/media \
  -H "X-API-Key: wg_your_key" \
  -F "to=5491155551234" \
  -F "type=document" \
  -F "file=@./report.pdf"
```

---

## Inbound Webhook Payload

When a message is received, a `POST` is sent to the account's webhook URL:

```json
{
  "event": "message.received",
  "accountId": "uuid-here",
  "timestamp": 1700000000000,
  "message": {
    "id": "internal-uuid",
    "from": "5491155551234@c.us",
    "to": "account-jid@c.us",
    "type": "text",
    "body": "Hello!"
  }
}
```

Failed deliveries are retried **up to 3 times** (after 2s, 5s, 10s).  
All attempts are logged in the dashboard under **Webhook Logs**.

---

## Session Persistence

Sessions are stored in `./sessions/{accountId}/` using `whatsapp-web.js` `LocalAuth`.  
As long as this directory is preserved, the client will reconnect without re-scanning the QR.

**Tip:** Mount `./sessions` and `./data` as Docker volumes for persistence in containers.

---

## Docker (optional)

```dockerfile
FROM node:20-slim
RUN apt-get update && apt-get install -y \
    chromium fonts-freefont-ttf libxss1 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
VOLUME ["/app/sessions", "/app/data"]
EXPOSE 3000
CMD ["node", "src/index.js"]
```

```bash
docker build -t wa-gateway .
docker run -p 3000:3000 \
  -v $(pwd)/sessions:/app/sessions \
  -v $(pwd)/data:/app/data \
  wa-gateway
```
