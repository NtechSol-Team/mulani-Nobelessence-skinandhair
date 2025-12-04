import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { Pool } from "pg";

const app = express();
const httpServer = createServer(app);

declare module "express-session" {
  interface SessionData {
    userId: string;
    username: string;
  }
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Create PostgreSQL pool for session store
const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Ensure session table exists
async function ensureSessionTable() {
  try {
    await sessionPool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" on "session" ("expire");
    `);
  } catch (err) {
    console.error("Error creating session table:", err);
  }
}

// Initialize session table on startup
ensureSessionTable().catch(console.error);

const PostgresSessionStore = pgSession(session);

// Configure session middleware with PostgreSQL store
app.use(
  session({
    store: new PostgresSessionStore({
      pool: sessionPool,
      tableName: "session",
    }),
    name: "connect.sid",
    secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 10 * 60 * 60 * 1000, // 10 hours
      path: "/",
    },
  })
);

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
