# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable
WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml source.config.mjs ./
COPY packages/upload-sdk/package.json packages/upload-sdk/package.json
COPY content ./content

RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

COPY . .

# NEXT_PUBLIC_* values are compiled into the browser bundle. Rebuild the image
# when one of these values changes. The remaining values are harmless build-only
# placeholders; real secrets are supplied to the running containers.
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_UPLOAD_BASE_URL
ARG NEXT_PUBLIC_UMAMI_DOMAINS
ARG NEXT_PUBLIC_UMAMI_ENABLED
ARG NEXT_PUBLIC_UMAMI_SCRIPT_URL
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID

ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_UPLOAD_BASE_URL=$NEXT_PUBLIC_UPLOAD_BASE_URL
ENV NEXT_PUBLIC_UMAMI_DOMAINS=$NEXT_PUBLIC_UMAMI_DOMAINS
ENV NEXT_PUBLIC_UMAMI_ENABLED=$NEXT_PUBLIC_UMAMI_ENABLED
ENV NEXT_PUBLIC_UMAMI_SCRIPT_URL=$NEXT_PUBLIC_UMAMI_SCRIPT_URL
ENV NEXT_PUBLIC_UMAMI_WEBSITE_ID=$NEXT_PUBLIC_UMAMI_WEBSITE_ID
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV BETTER_AUTH_SECRET=build-only-secret-not-used-at-runtime
ENV BETTER_AUTH_URL=$NEXT_PUBLIC_BASE_URL
ENV STRIPE_SECRET_KEY=sk_test_build_only
ENV STRIPE_WEBHOOK_SECRET=whsec_build_only
ENV TURNSTILE_SECRET_KEY=build-only
ENV RESEND_API_KEY=re_build_only
ENV EMAIL_FROM=build@example.invalid

RUN case "$NEXT_PUBLIC_UMAMI_ENABLED" in \
      1|[Tt][Rr][Uu][Ee]|[Yy][Ee][Ss]|[Oo][Nn]) \
        case "$NEXT_PUBLIC_UMAMI_SCRIPT_URL" in \
          ""|https://example.invalid/*) \
            echo "NEXT_PUBLIC_UMAMI_SCRIPT_URL must be set to a real URL when analytics is enabled" >&2; \
            exit 1; \
            ;; \
        esac \
        ;; \
    esac

RUN pnpm build

FROM base AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]

FROM dependencies AS migrator

ENV NODE_ENV=production

COPY --chown=node:node . .

USER node
CMD ["pnpm", "db:migrate"]
