import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
// session-based auth removed: express-session and connect-pg-simple imports removed

const app = express();

// When running behind a proxy (e.g. Render, Heroku), enable trust proxy
// so Express knows the original request protocol (https) and cookies
// with `secure: true` will be handled correctly.
  if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
  if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRET is not set in production - please set it in your environment.");
  }
}

// Enable gzip compression for responses to reduce transfer size
app.use(compression());
const httpServer = createServer(app);

// Session middleware removed — authentication/login has been removed intentionally.

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Configure CORS to allow credentialed requests from the frontend
const clientOrigin = process.env.CLIENT_ORIGIN || (process.env.NODE_ENV === "production" ? undefined : "http://localhost:5173");
if (clientOrigin) {
  app.use(
    cors({
      origin: clientOrigin,
      credentials: true,
    }),
  );
} else {
  // In production, require CLIENT_ORIGIN env var for security
  console.warn("CLIENT_ORIGIN is not set; cross-origin cookies may be blocked.");
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const status = res.statusCode;
      const statusIcon = status >= 200 && status < 300 ? "✓" : status >= 400 ? "✗" : "";
      const logLine = `${req.method} ${path} ${status} ${statusIcon} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // Only send response if headers haven't been sent yet
    if (!res.headersSent) {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    }
    console.error("Unhandled error:", err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5050", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
