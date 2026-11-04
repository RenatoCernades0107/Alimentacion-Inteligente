import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/session";
import { runChefTurn, type ChefEvent } from "@/lib/chef-turn";

/** La IA puede tardar (búsqueda web, recetas nuevas): se le da margen. */
export const maxDuration = 90;

const fail = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Un turno del Chef IA en streaming. Responde NDJSON (un evento por línea): pasos ("step"), trozos del
 * razonamiento del modelo ("thinking") y al final la respuesta ("reply") o "error".
 * POST /api/chef con el cuerpo de `ChefTurnInput` (src/lib/chef-turn.ts).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.family || !session.profile.role) return fail("unauthorized", 401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid", 400);
  }
  const locale = (await getLocale()) === "en" ? "en" : "es";
  const member = { supabase: session.supabase, user: session.user, profile: session.profile, family: session.family };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (e: ChefEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          open = false; // quien pidió se fue: se termina igual el turno, sin mandar nada
        }
      };
      try {
        send({ type: "reply", reply: await runChefTurn(member, body, locale, send) });
      } catch (e) {
        console.error("chef turn", e);
        send({ type: "error" });
      }
      if (open) controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
