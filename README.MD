## Usage
- Start the container with: `docker-compose up app`
- Check the console to scan the QR code
- Scan the code via whatsapp
- Send messages via curl or postman

## Send messages
Send messages by calling `/message` endpoint like:
- Send text messages
```bash
curl -v \
  -H "Accept: application/json" \
  -H "Content-type: application/json" \
  -X POST \
  -d '{"phone": "5917090909@c.us", "content": "test message"}' \
  http://localhost:3008/message
```

- Send image messages (`data` can be a url or a base64 string)
```bash
  curl -v \
  -H "Accept: application/json" \
  -H "Content-type: application/json" \
  -X POST \
  -d '{"phone": "5917090909@c.us", "content": "same img descr here", "media": { "data": "https://www.shutterstock.com/image-vector/sample-red-square-grunge-stamp-260nw-338250266.jpg", "mimetype": "image/png", "filename": "image.png" }}' \
  http://localhost:3008/message
```

## Publish a new version
```
docker build -t owencio/whatsapp-app:1.1 .
docker push owencio/whatsapp-app:1.1
```

## Release note:
- As of 2023-01-01, whatsapp docker container is not working due to "target was closed" error, then this repo is using a running container instead.