const PATTERNS = [
      /\d{6,}:[A-Za-z0-9_-]{20,}/g,
      /-----BEGIN[\s\S]+?PRIVATE KEY-----/g,
      /(password|passwd|token|secret|authorization)=([^\s&]+)/gi,
      /Bearer\s+[A-Za-z0-9._-]+/g,
    ];

    export function redact(text: string): string {
      let out = text;
      for (const p of PATTERNS) out = out.replace(p, "[REDACTED]");
      return out;
    }

    export function maskToken(token: string): string {
      const t = token.trim();
      const i = t.indexOf(":");
      if (i === -1) return t.length < 8 ? "********" : `${t.slice(0, 4)}**************${t.slice(-4)}`;
      return `${t.slice(0, i)}:**************${t.slice(-4)}`;
    }
