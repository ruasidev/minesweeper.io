# The API server. It shares code with the site (shared/), so it is built from the repository root:
#   docker build -f server/Dockerfile .

FROM node:24-alpine AS build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY shared /app/shared
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/server/dist ./dist
# the migrations, for scripts/migrate
COPY server/drizzle ./drizzle
USER node
CMD ["node", "dist/server/src/index.js"]
