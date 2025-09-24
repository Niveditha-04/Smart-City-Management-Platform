FROM node:20-alpine

# keep path consistent with runtime
WORKDIR /backend

# install deps first (cacheable)
COPY package*.json ./
# if you need dev deps for build scripts, drop --omit=dev
RUN npm ci --omit=dev

# then copy source
COPY . .

ENV NODE_ENV=production
ENV PORT=5050
EXPOSE 5050

CMD ["node", "server.js"]
