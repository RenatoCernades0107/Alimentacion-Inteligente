import { NextResponse, type NextRequest } from "next/server";
import { normalizeProduct, OFF_SEARCH_URL, OFF_USER_AGENT } from "@/lib/off";

/** Búsqueda de productos de marca en Open Food Facts. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const lang = request.nextUrl.searchParams.get("lang") === "en" ? "en" : "es";
  if (q.length < 3) return NextResponse.json({ products: [] });

  try {
    const res = await fetch(OFF_SEARCH_URL(q, lang), {
      headers: { "User-Agent": OFF_USER_AGENT },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json();
    const products = (data.hits ?? []).map((p: Record<string, unknown>) => normalizeProduct(p, lang)).filter(Boolean);
    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ products: [] });
  }
}
