FROM node:22-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

RUN mkdir -p uploads storage temp

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3002

CMD ["npm", "run", "start:dev"]
