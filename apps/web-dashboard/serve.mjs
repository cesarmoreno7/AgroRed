// Servidor estatico minimo (sin dependencias) para el build de Vite del dashboard.
// Sirve ./dist con fallback SPA a index.html y se enlaza a $PORT (Railway).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(fileURLToPath(new URL(".", import.meta.url)), "dist");
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

async function send(res, file, code = 200) {
  const body = await readFile(file);
  const ext = extname(file);
  res.writeHead(code, {
    "content-type": TYPES[ext] || "application/octet-stream",
    "cache-control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable"
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    const url = (req.url || "/").split("?")[0];
    if (url === "/health" || url === "/ping") {
      res.writeHead(200, { "content-type": "text/plain" });
      return res.end("ok");
    }

    let rel = normalize(decodeURIComponent(url)).replace(/^(\.\.[/\\])+/, "");
    if (rel === "/" || rel.endsWith("/")) rel += "index.html";
    const target = join(DIST, rel);

    try {
      const s = await stat(target);
      if (s.isFile()) return await send(res, target);
    } catch {
      /* no existe -> fallback SPA */
    }
    return await send(res, join(DIST, "index.html"));
  } catch {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("internal error");
  }
});

server.listen(PORT, () => {
  console.log(JSON.stringify({ service: "web-dashboard", msg: "static server up", port: PORT, dist: DIST }));
});
