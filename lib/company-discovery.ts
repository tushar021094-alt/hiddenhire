import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type DetectedProvider = "greenhouse" | "lever" | "ashby" | "workable" | "workday" | "structured-jobposting" | "unknown";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type CompanyDiscovery = {
  inputUrl: string;
  canonicalUrl: string;
  company?: string;
  provider: DetectedProvider;
  sourceIdentifier?: string;
  careersUrl: string;
  confidence: "high" | "medium" | "low";
  signals: string[];
};

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function isPrivateIp(hostname: string) {
  if (isIP(hostname) === 4) {
    const parts = hostname.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    const [a, b] = parts;
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
  }
  if (isIP(hostname) === 6) {
    const normalized = hostname.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
  }
  return false;
}

async function isSafePublicUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (!["http:", "https:"].includes(url.protocol)) return false;
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local") || isPrivateIp(hostname)) return false;
  try {
    const resolved = await lookup(hostname, { all: true, verbatim: true });
    if (!resolved.length || resolved.some(({ address }) => isPrivateIp(address))) return false;
  } catch {
    return false;
  }
  return true;
}
