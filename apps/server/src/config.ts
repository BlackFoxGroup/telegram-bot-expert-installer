import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
    import { dirname, join } from "node:path";
    import { fileURLToPath } from "node:url";
    import { randomBytes } from "node:crypto";

    const here = dirname(fileURLToPath(import.meta.url));
    export const ROOT = join(here, "..", "..", "..");
    export const DATA_DIR = join(ROOT, "data");
    export const WEB_DIST = join(ROOT, "apps", "web", "dist");
    export const PORT = Number(process.env.PORT || 4780);
    export const HOST = process.env.HOST || "127.0.0.1";

    export function ensureData(): string {
      mkdirSync(DATA_DIR, { recursive: true });
      const keyPath = join(DATA_DIR, "master.key");
      if (!existsSync(keyPath)) {
        writeFileSync(keyPath, randomBytes(32).toString("hex"), { mode: 0o600 });
      }
      return readFileSync(keyPath, "utf8").trim();
    }
