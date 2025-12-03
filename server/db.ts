// server/db.ts
import { Pool } from "pg";

// Use DATABASE_URL (recommended). Render/Neon will provide a connection string here.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({
  connectionString,
  // When connecting to some managed Postgres (including Neon), SSL is required.
  // Some environments may need `rejectUnauthorized: false`. If Neon gives SSL errors,
  // try adding `ssl: { rejectUnauthorized: false }` (but prefer the recommended Neon config).
  ssl: {
    rejectUnauthorized: false,
  },
});

// helper for simple queries
export async function query<T = any>(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const res = await client.query<T>(text, params);
    return res.rows;
  } finally {
    client.release();
  }
}
