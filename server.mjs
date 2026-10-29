import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Store, StoreError } from "./lib/store.mjs";
const root = path.dirname(fileURLToPath(import.meta.url));
export function createServer({
  dataRoot = path.join(root, "data"),
  port = 4377,
  seed = true,
} = {}) {
  const store = new Store(path.join(dataRoot, "maps")),
    token = crypto.randomBytes(32).toString("hex");
  if (seed)
    for (const name of fs
      .readdirSync(path.join(root, "examples"))
      .filter((n) => n.endsWith(".json"))) {
      const doc = JSON.parse(
        fs.readFileSync(path.join(root, "examples", name), "utf8"),
      );
      if (!store.history(doc.id).length)
        store.commit(doc.id, doc, {
          expectedRevision: 0,
          author: "Codex",
          summary: "Initial source-grounded explanation",
        });
    }
  const server = http.createServer(async (req, res) => {
    const json = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    try {
      const host = `127.0.0.1:${server.address().port}`;
      if (req.headers.host !== host)
        throw new StoreError("Use the printed 127.0.0.1 URL", 403);
      if (req.headers.origin && req.headers.origin !== `http://${host}`)
        throw new StoreError("Cross-origin access refused", 403);
      if (req.headers["sec-fetch-site"] === "cross-site")
        throw new StoreError("Cross-site access refused", 403);
      const url = new URL(req.url, `http://${host}`),
        parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "api") {
        if (req.method === "GET" && url.pathname === "/api/bootstrap")
          return json(200, { token, maps: store.list() });
        if (req.method === "GET" && url.pathname === "/api/maps")
          return json(200, store.list());
        const key = parts[2];
        if (!key || parts[1] !== "maps")
          throw new StoreError("Unknown API route", 404);
        if (req.method === "GET" && parts[3] === "history")
          return json(200, store.history(key));
        if (req.method === "GET" && parts.length === 3)
          return json(
            200,
            store.get(
              key,
              url.searchParams.has("revision")
                ? Number(url.searchParams.get("revision"))
                : undefined,
            ),
          );
        if (req.headers.authorization !== `Bearer ${token}`)
          throw new StoreError("Session token required", 403);
        if (
          !["PUT", "PATCH", "DELETE"].includes(req.method) ||
          parts.length !== 3
        )
          throw new StoreError("Unknown API route", 404);
        if (!req.headers["content-type"]?.startsWith("application/json"))
          throw new StoreError("JSON required", 415);
        let bytes = 0,
          chunks = [];
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 2 * 1024 * 1024)
            throw new StoreError("Map exceeds 2 MB", 413);
          chunks.push(chunk);
        }
        let body;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          throw new StoreError("Invalid JSON");
        }
        let result;
        if (req.method === "PUT")
          result = store.commit(key, body.document, body);
        if (req.method === "PATCH")
          result = store.patch(key, body.operations, body);
        if (req.method === "DELETE")
          result = store.commit(key, store.get(key).document, body, true);
        return json(200, result);
      }
      if (req.method !== "GET") throw new StoreError("Method not allowed", 405);
      const name =
        decodeURIComponent(url.pathname) === "/"
          ? "index.html"
          : decodeURIComponent(url.pathname).slice(1);
      const dist = path.join(root, "dist"),
        file = path.resolve(dist, name);
      if (
        !file.startsWith(dist + path.sep) ||
        !fs.existsSync(file) ||
        !fs.statSync(file).isFile()
      )
        throw new StoreError("File not found. Run npm run build first.", 404);
      const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      };
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] ?? "application/octet-stream",
      });
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      json(e.status ?? 400, { error: e.message });
    }
  });
  return {
    server,
    store,
    listen: () =>
      new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => resolve(server.address()));
      }),
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createServer({ port: Number(process.env.PORT ?? 4377) });
  await app.listen();
  console.log(
    `Structure Viewer: http://127.0.0.1:${app.server.address().port}`,
  );
}
