FROM node:20-alpine

# app directory
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV PORT=5050
EXPOSE 5050

# start the server
CMD ["node", "server.js"]
