import { NextResponse } from "next/server";
import { discoverCompanySource } from "@/lib/company-discovery";
import { getAuthenticatedUser } from "@/lib/supabase/server";

const MAX_URL_LENGTH = 2_048;

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser();

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
    const message =
      error instanceof Error ? error.message : "Company discovery failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
