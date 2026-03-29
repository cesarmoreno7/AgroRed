import type { Express, Request, Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { ServiceRouteDefinition } from "../../../infrastructure/http/serviceRegistry.js";
import { logError, logInfo } from "../../../shared/logger.js";

function writeParsedBody(proxyReq: { setHeader(name: string, value: string | number): void; write(chunk: string): void }, req: Request): void {
  if (req.method === "GET" || req.method === "HEAD" || req.body == null) {
    return;
  }

  if (typeof req.body !== "object") {
    return;
  }

  if (Object.keys(req.body as Record<string, unknown>).length === 0) {
    return;
  }

  const body = JSON.stringify(req.body);

  proxyReq.setHeader("Content-Type", "application/json");
  proxyReq.setHeader("Content-Length", Buffer.byteLength(body));
  proxyReq.write(body);
}

export function registerServiceProxies(app: Express, services: ServiceRouteDefinition[]): void {
  services.forEach((service) => {
    app.use(
      service.pathPrefix,
      createProxyMiddleware<Request, Response>({
        target: service.target,
        changeOrigin: true,
        proxyTimeout: 10_000,
        timeout: 10_000,
        pathRewrite: (_path, req) => req.originalUrl,
        on: {
          proxyReq: (proxyReq, req) => {
            writeParsedBody(proxyReq, req);

            if (req.correlationId) {
              proxyReq.setHeader("x-correlation-id", req.correlationId);
            }
          },
          error: (error, req, res) => {
            logError("proxy.error", {
              correlationId: req.correlationId,
              downstreamService: service.name,
              target: service.target,
              message: error.message
            });

            const payload = JSON.stringify({
              success: false,
              error: {
                code: "DOWNSTREAM_SERVICE_UNAVAILABLE",
                message: `El servicio ${service.name} no esta disponible.`,
                correlationId: req.correlationId ?? null
              }
            });

            if ("writeHead" in res) {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(payload);
            }
          }
        }
      })
    );

    logInfo("proxy.registered", {
      downstreamService: service.name,
      pathPrefix: service.pathPrefix,
      target: service.target
    });
  });
}
