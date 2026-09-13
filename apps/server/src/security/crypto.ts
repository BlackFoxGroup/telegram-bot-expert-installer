import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

    export class Vault {
      private readonly key: Buffer;
      constructor(masterHex: string) {
        this.key = scryptSync(masterHex, "expert-installer", 32);
      }
      encrypt(plain: string): string {
        const iv = randomBytes(12);
        const c = createCipheriv("aes-256-gcm", this.key, iv);
        const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
        const tag = c.getAuthTag();
        return Buffer.concat([iv, tag, enc]).toString("base64");
      }
      decrypt(blob: string): string {
        const buf = Buffer.from(blob, "base64");
        const iv = buf.subarray(0, 12);
        const tag = buf.subarray(12, 28);
        const data = buf.subarray(28);
        const d = createDecipheriv("aes-256-gcm", this.key, iv);
        d.setAuthTag(tag);
        return Buffer.concat([d.update(data), d.final()]).toString("utf8");
      }
    }
