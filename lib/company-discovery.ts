export type DetectedProvider = "greenhouse" | "lever" | "ashby" | "workable" | "structured-jobposting" | "unknown";

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
function isSafePublicUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (!["http:", "https:"].includes(url.protocol)) return false;
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return false;
  if (/^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^169\.254\./.test(hostname)) return false;
  const private172 = hostname.match(/^172\.(\d+)\./);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;
  return true;
}

function providerFromUrl(url: URL): { provider: DetectedProvider; identifier?: string; signal?: string } {
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  const greenhouse = host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io" || /greenhouse\.io/i.test(host);
  if (greenhouse) return { provider: "greenhouse", identifier: path.split("/").filter(Boolean)[0], signal: "Greenhouse career URL" };
  if (host === "jobs.lever.co" || host.endsWith(".lever.co")) return { provider: "lever", identifier: path.split("/").filter(Boolean)[0], signal: "Lever career URL" };
  if (host === "jobs.ashbyhq.com" || host.endsWith(".ashbyhq.com")) return { provider: "ashby", identifier: path.split("/").filter(Boolean)[0], signal: "Ashby career URL" };
  if (host === "jobs.workable.com" || host === "apply.workable.com" || host.endsWith(".workable.com")) return { provider: "workable", identifier: path.split("/").filter(Boolean)[0], signal: "Workable career URL" };
  return { provider: "unknown" };
}

function extractJsonLdCompany(html: string) {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : parsed?.["@graph"] ?? [parsed];
      for (const node of nodes) {
        if (node?.hiringOrganization?.name) return String(node.hiringOrganization.name);
        if (node?.["@type"] === "Organization" && node?.name) return String(node.name);
      }
    } catch {}
  }
  return undefined;
}

export async function discoverCompanySource(inputUrl: string): Promise<CompanyDiscovery> {
  if (!isSafePublicUrl(inputUrl)) throw new Error("Only public HTTP(S) company or career URLs are allowed.");
  const canonicalUrl = new URL(inputUrl).toString();
  const direct = providerFromUrl(new URL(canonicalUrl));
  const response = await fetchPublicPage(canonicalUrl);
  const finalUrl = new URL(response.url);
  const html = await response.text();
  const signals: string[] = [];
  if (direct.signal) signals.push(direct.signal);

  const detected = direct.provider !== "unknown" ? direct : providerFromHtml(html, finalUrl, signals);
  const company = extractJsonLdCompany(html);
  if (company) signals.push("Organization/JobPosting structured data");

  const careersUrl = detected.provider === "unknown" ? finalUrl.toString() : finalUrl.toString();
  return {
    inputUrl,
    canonicalUrl: finalUrl.toString(),
    company,
    provider: detected.provider,
    sourceIdentifier: detected.identifier,
    careersUrl,
    confidence: detected.provider === "unknown" ? (company ? "low" : "low") : direct.provider !== "unknown" ? "high" : "medium",
    signals: [...new Set(signals)],
  };
}

async function fetchPublicPage(startUrl: string) {
  let currentUrl = startUrl;
  for (let redirectCount = 0; redirectCount <= 5; redirectCount++) {
    if (!isSafePublicUrl(currentUrl)) {
      throw new Error("Redirect target is not a public HTTP(S) URL.");
    }
    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: { "user-agent": "HiddenHireCompanyDiscovery/1.0" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    });
    if (response.status < 300 || response.status >= 400) {
      if (!response.ok) throw new Error(`Career page returned HTTP ${response.status}.`);
      return response;
    }
    const location = response.headers.get("location");
    if (!location) throw new Error("Career page returned a redirect without a target.");
    currentUrl = new URL(location, currentUrl).toString();
  }
  throw new Error("Too many redirects while discovering company source.");
}

function providerFromHtml(html: string, signals: string[]) {
  const greenhouse = html.match(/(?:boards-api|boards|job-boards)\.greenhouse\.io[/"']/i);
  if (greenhouse) { signals.push("Greenhouse URL/API reference"); return { provider: "greenhouse" as const, identifier: extractFirst(html, /(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/)?([a-z0-9_-]+)/i) }; }

  const lever = html.match(/jobs\.lever\.co\/([a-z0-9_-]+)/i);
  if (lever) { signals.push("Lever job URL reference"); return { provider: "lever" as const, identifier: lever[1] }; }

  const ashby = html.match(/jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i);
  if (ashby) { signals.push("Ashby job URL reference"); return { provider: "ashby" as const, identifier: ashby[1] }; }

  const workable = html.match(/(?:jobs|apply)\.workable\.com\/([a-z0-9_-]+)/i);
  if (workable) { signals.push("Workable job URL reference"); return { provider: "workable" as const, identifier: workable[1] }; }

  if (/<script[^>]+type=["']application\/ld\+json["']/i.test(html) && /"@type"\s*:\s*["']JobPosting["']/i.test(html)) {
    signals.push("JobPosting JSON-LD");
    return { provider: "structured-jobposting" as const };
  }
  return { provider: "unknown" as const };
}

function extractFirst(html: string, regex: RegExp) {
  const match = html.match(regex);
  return match?.[1];
}
