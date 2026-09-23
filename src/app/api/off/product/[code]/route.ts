import { NextResponse, type NextRequest } from "next/server";
import { normalizeProduct, OFF_PRODUCT_URL, OFF_USER_AGENT } from "@/lib/off";

/** Producto por código de barras (Open Food Facts). */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/off/product/[code]">) {
  const { code } = await ctx.params;
  const lang = request.nextUrl.searchParams.get("lang") === "en" ? "en" : "es";
  if (!/^\d{6,14}$/.test(code)) return NextResponse.json({ product: null });

  try {
    const res = await fetch(OFF_PRODUCT_URL(code), {
      headers: { "User-Agent": OFF_USER_AGENT },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json();
    const product = data.status === 1 && data.product ? normalizeProduct({ ...data.product, code }, lang) : null;
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ product: null });
  }
}
