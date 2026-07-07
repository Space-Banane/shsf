FROM node:24-bookworm-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY Backend/package.json Backend/pnpm-lock.yaml Backend/pnpm-workspace.yaml ./Backend/
COPY UI/package.json UI/pnpm-lock.yaml UI/pnpm-workspace.yaml ./UI/

RUN cd Backend && pnpm install --frozen-lockfile && cd ../UI && pnpm install --frozen-lockfile

COPY . .

RUN cd Backend && DATABASE_URL=mysql://x:x@localhost/x pnpm run generate && pnpm run build && cd ../UI && pnpm run tailwind:build && pnpm run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Backend/package.json Backend/pnpm-lock.yaml Backend/pnpm-workspace.yaml ./Backend/
COPY Backend/prisma ./Backend/prisma

RUN cd Backend && pnpm install --prod --frozen-lockfile && DATABASE_URL=mysql://x:x@localhost/x pnpm run generate

COPY --from=build /app/Backend/dist ./Backend/dist
COPY --from=build /app/UI/build ./UI/build

EXPOSE 5000

CMD ["sh", "-c", "cd /app/Backend && pnpm migrate:deploy && cd dist && node index.js"]
