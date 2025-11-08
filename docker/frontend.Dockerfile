FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY telegram_poker_bot/frontend/package.json telegram_poker_bot/frontend/package-lock.json* ./
RUN npm ci

# Copy source
COPY telegram_poker_bot/frontend/ .

# Build assets
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
