import { storage } from "./storage";
import https from "https";
import http from "http";

function log(message: string, source = "cron") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export function setupCronJob() {
  const MINUTES = 14;
  const INTERVAL = MINUTES * 60 * 1000; // 14 minutes in milliseconds

  log(`Scheduling keep-alive cron job to run every ${MINUTES} minutes`);

  const runJob = async () => {
    log("Running keep-alive cron job...");

    // 1. Ping the database
    try {
      await storage.ping();
      log("Database ping successful");
    } catch (error) {
      log(`Database ping failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 2. Ping the server itself (HTTP GET to external URL or localhost health check)
    const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || "https://nakranitechno.onrender.com";
    const port = process.env.PORT || "5050";
    const urlsToPing = [
      externalUrl,
      `http://localhost:${port}/api/health`
    ];

    for (const targetUrl of urlsToPing) {
      if (!targetUrl) continue;

      const lib = targetUrl.startsWith("https") ? https : http;

      try {
        lib.get(targetUrl, (res) => {
          log(`Ping to ${targetUrl} responded with status code: ${res.statusCode}`);
        }).on("error", (err) => {
          log(`Ping to ${targetUrl} failed: ${err.message}`);
        });
      } catch (err) {
        log(`Ping to ${targetUrl} failed with error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  // Run once immediately on start
  runJob();

  // Set interval to run every 14 minutes
  const intervalId = setInterval(runJob, INTERVAL);

  // Allow the Node process to exit cleanly if needed
  intervalId.unref();
}
