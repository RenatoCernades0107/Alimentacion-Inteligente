import { redirect } from "next/navigation";
import { requireMember } from "@/lib/session";

/** Atajo a la ficha propia: /weight/<mi id>. */
export default async function WeightIndexPage() {
  const { user } = await requireMember();
  redirect(`/weight/${user.id}`);
}
