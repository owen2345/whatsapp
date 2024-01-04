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

## How to use it in your project
- via docker-compose.yml
```yaml
    whatsapp:
      tty: true
      container_name: whatsapp
      image: owencio/whatsapp-app:1.1
      ports:
        - "3008:3000"
``` 
- Via kubernetes
```yaml
---
apiVersion: v1
kind: Service
metadata:
  name: wsapp-service
spec:
  ports:
    - port: 3000
      name: wsp-port
  clusterIP: None
  selector:
    app: <%= whatsapp.app_name %>

---

apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: &app_name <%= whatsapp.app_name %>
spec:
  selector:
    matchLabels:
      app: *app_name
  serviceName: <%= whatsapp.service_name %>
  replicas: 1
  template:
    metadata:
      labels:
        app: *app_name
    spec:
      containers:
        - name: *app_name
          image: owencio/whatsapp-app:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 6379
              name: wsp-port
```
Use the internal service url, like: `curl http://wsapp-service.default.svc.cluster.local:3000/`

## Publish a new version
```
docker build -t owencio/whatsapp-app:1.1 .
docker push owencio/whatsapp-app:1.1
```

## Release note:
- As of 2023-01-01, whatsapp docker container is not working due to "target was closed" error, then this repo is using a running container instead.