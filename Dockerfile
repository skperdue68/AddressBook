FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
CMD ["sh","-c","node src/db/init.js && node src/db/seed-houses.js && node src/index.js"]
