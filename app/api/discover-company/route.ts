import { NextResponse } from "next/server";
import { discoverCompanySource } from "@/lib/company-discovery";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const MAX_URL_LENGTH = 2_048;
const MAX_BODY_BYTES = 8_192;

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }

    const { user, error: authError } = await getAuthenticatedUser();

    const rate = checkRateLimit(`discover-company:${user?.id ?? 'anonymous'}`, 10, 60_000);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

    if (!user) {
      return NextResponse.json(
        { error: authError || "Authentication is required." },
        { status: 401 },
      );
    }

    const body = await request.json() as { url?: unknown };
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!url) {
      return NextResponse.json(
        { error: "Please provide a company or careers URL." },
        { status: 400 },
      );
    }

    if (url.length > MAX_URL_LENGTH) {
      return NextResponse.json(
        { error: "The company URL is too long." },
        { status: 413 },
      );
    }

    const result = await discoverCompanySource(url);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[discover-company] discovery failed", error);
    return NextResponse.json(
      { error: "Company discovery failed. Please check the URL and try again." },
      { status: 400 },
    );
  }
}
