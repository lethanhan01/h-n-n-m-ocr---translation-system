import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import net from "net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(findAvailablePort(startPort + 1));
    });

    server.once("listening", () => {
      server.close(() => resolve(startPort));
    });

    server.listen(startPort, "0.0.0.0");
  });
}

async function startServer() {
  const app = express();
  const DEFAULT_PORT = 3000;
  const DEFAULT_HMR_PORT = 24678;

  const PORT = await findAvailablePort(DEFAULT_PORT);
  const HMR_PORT = await findAvailablePort(DEFAULT_HMR_PORT);

  app.use(express.json({ limit: "50mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Hán Nôm OCR Server is active" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          port: HMR_PORT,
        },
      },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    if (process.env.NODE_ENV !== "production") {
      console.log(`✅ Vite HMR listening on port ${HMR_PORT}`);
    }
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
