import { NextResponse } from "next/server";
import { discoverCompanySource } from "@/lib/company-discovery";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown };
    if (typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json({ error: "Please provide a company or careers URL." }, { status: 400 });
    }
    const result = await discoverCompanySource(body.url.trim());
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Company discovery failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
