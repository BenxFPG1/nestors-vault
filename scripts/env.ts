/** Laadt .env.local (zoals Next.js dat doet) en daarna .env als fallback. */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });
