import dns from 'node:dns';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env from root workspace and current working directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

// Ensure resilient DNS resolution using Google & Cloudflare DNS (fixes local ISP DNS drops)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  const origLookup = dns.lookup;
  (dns as any).lookup = (hostname: string, options: any, callback: any) => {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'object' ? options : {};
    dns.resolve4(hostname, (err, addresses) => {
      if (!err && addresses && addresses.length > 0) {
        if (opts.all) {
          cb(null, addresses.map((addr) => ({ address: addr, family: 4 })));
        } else {
          cb(null, addresses[0], 4);
        }
      } else {
        origLookup(hostname, options, callback);
      }
    });
  };
} catch {
  // Fallback to default
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is missing.');
}

// Resilient pool configuration specifically tuned for Neon serverless compute wakeups
const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000, // 15 seconds allows cold-starting Neon VMs to spin up smoothly
  idleTimeoutMillis: 30000,
  max: 10,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}

/**
 * Neon Cold-Start Warmup Helper.
 * Attempts a lightweight query with retry backoff to cleanly wake up sleeping serverless instances.
 */
export async function warmupDatabase(maxRetries = 8, retryDelayMs = 3500): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query('SELECT 1 as warmup');
      return true;
    } catch (err: unknown) {
      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt) {
        throw new Error(
          `Failed to connect to Neon PostgreSQL after ${maxRetries} attempts: ${(err as Error).message}`
        );
      }
      console.log(
        `⏳ [Neon DB Warmup] Compute instance is waking up... (Attempt ${attempt}/${maxRetries}). Retrying in ${retryDelayMs / 1000}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  return false;
}

export * from '@prisma/client';
export default prisma;
