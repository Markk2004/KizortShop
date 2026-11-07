import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const backendUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "https://kizortshop-1.onrender.com/api/v1";

  const start = Date.now();
  try {
    const res = await fetch(`${backendUrl}/health`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "User-Agent": "KaiZort-Vercel-KeepAlive/1.0",
      },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - start,
      backend: data,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to ping backend",
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}
