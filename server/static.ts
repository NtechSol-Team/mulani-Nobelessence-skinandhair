import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static files with long-term caching for hashed assets.
  // index.html should not be aggressively cached so client sees updates.
  app.use(
    express.static(distPath, {
      index: false,
      // Default maxAge for static assets (set long for fingerprinted files)
      maxAge: "1y",
      setHeaders(res, filePath) {
        // Do not cache HTML (index.html) — ensure clients revalidate
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
        // Let other static assets use the default long cache
      },
    }),
  );

  // fall through to index.html for client-side routing
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
