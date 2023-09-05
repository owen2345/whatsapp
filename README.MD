## Usage
- Start the container with: `docker-compose up app`
- Check the console to scan the QR code
- Scan the code via whatsapp

## Send messages
Send messages by calling `/message` endpoint like:
```bash
curl -v \
  -H "Accept: application/json" \
  -H "Content-type: application/json" \
  -X POST \
  -d '{"phone": "5917090909@c.us", "content": "test message"}' \
  http://localhost:3008/message
```