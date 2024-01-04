FROM owencio/whatsapp-app:latest

WORKDIR /usr/src/app
COPY . /usr/src/app
RUN npm install
