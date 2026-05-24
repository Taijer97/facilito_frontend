FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN if [ -s package-lock.json ]; then npm ci; else npm install; fi

COPY . .

ARG GEMINI_API_KEY=""
ENV GEMINI_API_KEY=$GEMINI_API_KEY

RUN if [ -n "$GEMINI_API_KEY" ]; then echo "GEMINI_API_KEY=$GEMINI_API_KEY" > .env.production; fi

RUN npm run build

FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.ts ./server.ts

EXPOSE 3000

CMD ["node", "--import", "tsx", "server.ts"]
