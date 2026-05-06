import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import net from "net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔥 function tìm port trống
function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.listen(startPort, () => {
      server.close(() => resolve(startPort));
    });

    server.on("error", () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

async function startServer() {
  const app = express();
  const DEFAULT_PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Hán Nôm OCR Server is active" });
  });

  // Vite middleware (dev)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // 🔥 tìm port trống
  const PORT = await findAvailablePort(DEFAULT_PORT);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
}

startServer();