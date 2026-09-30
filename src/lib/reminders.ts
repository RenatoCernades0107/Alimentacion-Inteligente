import { ageOn } from "./body";
import { daysBetween, startOfWeek } from "./dates";

export type ReminderBody = {
  id: string;
  profileId: string | null;
  dependentId: string | null;
  birthDate: string | null;
  /** Meta de peso vigente (solo adultos). */
  goalKg: number | null;
};

export type WeighReminder =
  /** Un adulto con meta activa que no se pesó esta semana: se le avisa a él. */
  | { kind: "self"; bodyId: string; profileId: string; key: string }
  /** Un menor o un integrante sin cuenta sin pesajes recientes: se avisa a los padres. */
  | { kind: "kid"; bodyId: string; personId: string; key: string };

/**
 * Quién necesita un recordatorio para pesarse hoy. La clave sirve para no repetirlo (notification_log).
 * - Adultos con cuenta y meta: cada semana, si llevan 7 días o más sin pesarse.
 * - Menores e integrantes sin cuenta: solo a los padres y con calma (no hay metas de peso en menores):
 *   cada mes si pasaron 30 días (menores de 3 años) o 90 días (mayores). Los lactantes no.
 */
export function weighReminders(args: {
  today: string;
  bodies: ReminderBody[];
  /** Fecha del último pesaje de cada ficha corporal (ausente = nunca). */
  lastLog: Record<string, string | undefined>;
}): WeighReminder[] {
  const out: WeighReminder[] = [];
  const week = startOfWeek(args.today);
  const month = args.today.slice(0, 7);

  for (const b of args.bodies) {
    const age = ageOn(b.birthDate, args.today);
    if (!age || age.months < 12) continue;
    const last = args.lastLog[b.id];
    const daysSince = last ? daysBetween(last, args.today) : Infinity;

    if (b.profileId && age.years >= 18) {
      if (b.goalKg !== null && daysSince >= 7) out.push({ kind: "self", bodyId: b.id, profileId: b.profileId, key: `weigh:${b.id}:${week}` });
    } else if (daysSince > (age.months < 36 ? 30 : 90)) {
      out.push({ kind: "kid", bodyId: b.id, personId: (b.profileId ?? b.dependentId)!, key: `weighkid:${b.id}:${month}` });
    }
  }
  return out;
}
