import { exec } from "node:child_process";
import { ensureData, HOST, PORT } from "./config.js";
import { buildApp } from "./app.js";

const key = ensureData();
const { app } = await buildApp(key);
await app.listen({ host: HOST, port: PORT });
const url = `http://${HOST}:${PORT}`;
console.log(`Telegram Bot Expert → ${url}`);
if (process.env.NO_OPEN !== "1") {
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}
