# syntax=docker/dockerfile:1

# --- Front (Vite + React)
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.node.json vite.config.ts vite.config.js vite.config.d.ts tailwind.config.js postcss.config.js index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# --- API Go
FROM golang:alpine AS api
RUN apk add --no-cache git ca-certificates
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /pinkstarsociety .

# --- Image finale : un seul processus (API + fichiers statiques)
FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata curl && \
    adduser -D -H -u 65532 nonroot
WORKDIR /app
COPY --from=api /pinkstarsociety /app/pinkstarsociety
COPY --from=frontend /app/dist /app/dist
RUN chmod +x /app/pinkstarsociety && chmod -R a+rX /app/dist
ENV STATIC_ROOT=/app/dist
ENV PORT=8080
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/app/pinkstarsociety"]
