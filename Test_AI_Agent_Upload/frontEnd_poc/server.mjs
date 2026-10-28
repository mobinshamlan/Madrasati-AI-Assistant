// Zero-dependency dev server: serves this folder and proxies /api/* to the backend.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 5173);
const BACKEND = new URL(process.env.BACKEND_URL || "http://localhost:8000");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    const up = http.request({ hostname: BACKEND.hostname, port: BACKEND.port, path: req.url, method: req.method,
      headers: { ...req.headers, host: BACKEND.host } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on("error", () => {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ detail: `الـ backend غير متاح على ${BACKEND.origin}. شغّله أو غيّر BACKEND_URL.` }));
    });
    return req.pipe(up);
  }
  const path = normalize(decodeURIComponent(req.url.split("?")[0]));
  const file = join(ROOT, path === "/" || path === "\\" ? "index.html" : path);
  if (!file.startsWith(ROOT) || !TYPES[extname(file)]) { res.writeHead(404).end("Not found"); return; }
  try { res.writeHead(200, { "content-type": TYPES[extname(file)] }).end(await readFile(file)); }
  catch { res.writeHead(404).end("Not found"); }
}).listen(PORT, () => console.log(`UI:  http://localhost:${PORT}\nAPI: proxying /api/* -> ${BACKEND.origin}`));
