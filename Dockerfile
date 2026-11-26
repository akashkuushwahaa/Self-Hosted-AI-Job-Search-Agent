# Shortlist in a container: `docker compose up` (docker-compose.yml) runs the app, the worker and
# Postgres. One build, two targets: `app` (Next.js) and `worker` (adds Chromium for company research).

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Dev dependencies stay: the worker runs TypeScript through tsx, and migrations use drizzle-kit.
RUN npm ci

FROM deps AS build
COPY . .
# Module-level checks need these to exist while Next collects pages; the real values come at run time.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-only-placeholder-not-used-at-runtime \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim AS app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "start"]

FROM app AS worker
# Headless Chromium and its system libraries, for Playwright company research.
RUN npx playwright install --with-deps --only-shell chromium
CMD ["npm", "run", "worker"]
