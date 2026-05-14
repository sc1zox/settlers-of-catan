FROM node:24-bookworm-slim AS base

ENV CI=true
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /workspace

# 1. Nur die Dateien kopieren, die Abhängigkeiten definieren
COPY package.json package-lock.json .npmrc ./

# 2. Jetzt installieren (Docker merkt sich diesen Schritt)
RUN npm ci --prefer-offline --no-audit --no-fund --loglevel error

# 3. Erst JETZT den restlichen Code kopieren
COPY . .

EXPOSE 3000
EXPOSE 4200
