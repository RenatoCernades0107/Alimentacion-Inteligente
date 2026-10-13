import { redirect } from "next/navigation";
import { isValidDate } from "@/lib/dates";

/** El calendario ahora es el inicio; se mantiene esta ruta para links y notificaciones antiguas. */
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { date } = await searchParams;
  redirect(isValidDate(date) ? `/?date=${date}` : "/");
}
