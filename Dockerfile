FROM node:24-bookworm-slim AS base

WORKDIR /workspace

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

EXPOSE 3000
EXPOSE 4200
