# AGRORED - dashboard React/Vite (servicio Railway: agrored-web-dashboard).
#
# En Railway, servicio agrored-web-dashboard -> Settings:
#   - Build: Dockerfile
#   - Dockerfile Path: apps/web-dashboard/Dockerfile   (contexto = raiz del repo)
#   - Variables:  VITE_API_BASE_URL = https://api-gateway-production-8d93.up.railway.app
#     (Vite hornea las VITE_* en el bundle EN BUILD TIME; sin esto la app llama
#      a su propio dominio en vez del gateway.)
#
# Build: compila con Node; sirve el /dist con un servidor estatico sin dependencias
# (serve.mjs) enlazado a $PORT, con fallback SPA a index.html.

# ---------- build ----------
FROM node:22-bookworm AS build
WORKDIR /repo
COPY . .
ARG VITE_API_BASE_URL="https://api-gateway-production-8d93.up.railway.app"
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm ci --no-audit --no-fund
RUN npm run build:dashboard

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
COPY --from=build /repo/apps/web-dashboard/dist ./dist
COPY apps/web-dashboard/serve.mjs ./serve.mjs
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "serve.mjs"]
