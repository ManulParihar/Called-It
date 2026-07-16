// Loads variables from .env.local for standalone scripts like the worker.
//
// The Next.js app loads env files on its own, but a script started with tsx does
// not, so we load the file here. Node 22 can read an env file directly.

import { existsSync } from "node:fs";

export function loadEnv(file = ".env.local"): void {
  if (!existsSync(file)) return;
  const loader = (process as unknown as { loadEnvFile?: (path: string) => void })
    .loadEnvFile;
  if (typeof loader === "function") {
    loader(file);
  }
}
