import pino from "pino";

const STELLAR_SECRET_REGEX = /^S[0-9A-Z]{55}$/;

function redactValue(value: unknown): unknown {
  if (typeof value === "string" && STELLAR_SECRET_REGEX.test(value)) {
    return "[REDACTED]";
  }
  return value;
}

function redactObject(obj: any): any {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(redactObject);
  if (typeof obj === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "secretKey" || k === "privateKey" || k === "seed") {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactObject(v);
      }
    }
    return out;
  }
  return redactValue(obj);
}

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  // keep path-based redaction for structured fields
  redact: { paths: ["*.secretKey", "*.privateKey", "*.seed"], censor: "[REDACTED]" },
  // ensure values (strings) that match Stellar secret pattern are redacted anywhere
  formatters: {
    log(obj: Record<string, any>) {
      return redactObject(obj);
    },
  },
});

export { logger, redactObject, STELLAR_SECRET_REGEX };
