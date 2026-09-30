import type { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createTranslator } from "next-intl";
import { getSession } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { PlanDocument, type Translate } from "@/lib/plan-pdf/document";
import { loadPlanData } from "@/lib/plan-pdf/load";
import { parsePlanDates, planFileName } from "@/lib/plan-pdf/shared";
import type { PlanData } from "@/lib/plan-pdf/types";
import es from "../../../../messages/es.json";
import en from "../../../../messages/en.json";

// Con fotos, un mes de comidas puede tardar varios segundos en armarse.
export const maxDuration = 60;

const fail = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

function renderPdf(data: PlanData) {
  const t = createTranslator({ locale: data.locale, messages: data.locale === "en" ? en : es }) as unknown as Translate;
  return renderToBuffer(<PlanDocument data={data} t={t} />);
}

/**
 * PDF con la lista de compras y el plan de comidas (con foto, ingredientes y preparación) de los días elegidos.
 * GET /api/plan-pdf?dates=2026-09-29,2026-09-30&shopping=1&plan=1
 * Cualquier miembro de la familia puede descargarlo: solo lee, y RLS limita lo que ve a su familia.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.family || !session.profile.role) return fail("unauthorized", 401);
  const { supabase, family, profile } = session;

  const params = request.nextUrl.searchParams;
  const dates = parsePlanDates(params.get("dates"), todayIn(family.timezone));
  const plan = params.get("plan") !== "0";
  const shopping = params.get("shopping") !== "0";
  if (!dates || (!plan && !shopping)) return fail("invalid", 400);

  const locale = profile.locale === "en" ? "en" : "es";
  try {
    const data = await loadPlanData({ supabase, family, locale, dates, plan, shopping, origin: request.nextUrl.origin });
    if (!data.meals.length) return fail("no_meals", 422);

    const pdf = await renderPdf(data);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${planFileName(locale, dates, { plan, shopping })}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[plan-pdf]", error);
    return fail("server", 500);
  }
}
