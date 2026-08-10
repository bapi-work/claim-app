# Debian-slim (not Alpine) — Prisma's query engine has well-known OpenSSL detection problems
# on musl/Alpine. Slim avoids that class of bug entirely.

# --- deps + build ---
FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime ---
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma

RUN mkdir -p uploads
EXPOSE 4000

# Applies pending migrations, then starts the API. Safe to run on every container start —
# `prisma migrate deploy` is a no-op when the database is already up to date.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
