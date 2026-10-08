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
# Brings the database up to date, then starts the API. If the database can't be reached or a migration fails,
# it stops here with the reason in the log, and the host keeps the previous version running
CMD ["sh", "-c", "node dist/server/src/scripts/migrate.js && exec node dist/server/src/index.js"]
