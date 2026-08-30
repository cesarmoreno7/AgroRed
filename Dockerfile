# AGRORED - monolito (api-gateway + codigo de todos los apps/*-service).
# Se usa en Railway en lugar de Railpack: Railpack 0.38 fallaba en el paso
# "install apt packages: libatomic1" (severity: error) sobre Debian trixie.
# Mismo par build/start que render.yaml: npm run build:monolith / start:monolith.

FROM node:22-bookworm

WORKDIR /app

# Copia todo el monorepo (el .env NO se copia: esta en .gitignore/.dockerignore;
# Railway inyecta las variables en runtime).
COPY . .

# Dependencias (incluye dev: se necesita typescript para compilar) + build del monolito.
RUN npm install --include=dev --no-audit --no-fund \
 && npm run build:monolith

ENV NODE_ENV=production

# Railway define PORT; la app tambien respeta API_GATEWAY_PORT (default 8080).
EXPOSE 8080

# Arranque del monolito. Las migraciones se corren aparte (npm run migrate);
# 035_demo_access_expiry.sql ya esta aplicada en Neon.
CMD ["npm", "run", "start:monolith"]
