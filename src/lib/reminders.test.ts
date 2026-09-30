import { describe, expect, it } from "vitest";
import { weighReminders, type ReminderBody } from "./reminders";

const today = "2026-09-30"; // miércoles; la semana empieza el lunes 2026-09-28
const adult: ReminderBody = { id: "b-adult", profileId: "p1", dependentId: null, birthDate: "1988-03-03", goalKg: 70 };

describe("recordatorios de pesaje", () => {
  it("adulto con meta: avisa semanal si lleva 7 días o más sin pesarse", () => {
    expect(weighReminders({ today, bodies: [adult], lastLog: { "b-adult": "2026-09-22" } })).toEqual([
      { kind: "self", bodyId: "b-adult", profileId: "p1", key: "weigh:b-adult:2026-09-28" },
    ]);
    expect(weighReminders({ today, bodies: [adult], lastLog: { "b-adult": "2026-09-24" } })).toEqual([]);
    expect(weighReminders({ today, bodies: [adult], lastLog: {} })).toHaveLength(1);
  });

  it("adulto sin meta no recibe recordatorios", () => {
    expect(weighReminders({ today, bodies: [{ ...adult, goalKg: null }], lastLog: {} })).toEqual([]);
  });

  it("la clave es la misma toda la semana (no se repite) y cambia la siguiente", () => {
    const monday = weighReminders({ today: "2026-09-28", bodies: [adult], lastLog: {} })[0];
    const friday = weighReminders({ today: "2026-10-02", bodies: [adult], lastLog: {} })[0];
    const nextWeek = weighReminders({ today: "2026-10-05", bodies: [adult], lastLog: {} })[0];
    expect(monday.key).toBe(friday.key);
    expect(nextWeek.key).not.toBe(monday.key);
  });

  it("menores y sin cuenta: a los padres, con calma", () => {
    const kid: ReminderBody = { id: "b-kid", profileId: null, dependentId: "d1", birthDate: "2020-05-01", goalKg: null };
    // 6 años: 90 días.
    expect(weighReminders({ today, bodies: [kid], lastLog: { "b-kid": "2026-07-15" } })).toEqual([]);
    expect(weighReminders({ today, bodies: [kid], lastLog: { "b-kid": "2026-06-01" } })).toEqual([
      { kind: "kid", bodyId: "b-kid", personId: "d1", key: "weighkid:b-kid:2026-09" },
    ]);
    // 2 años: 30 días.
    const toddler = { ...kid, id: "b-tod", birthDate: "2024-06-01" };
    expect(weighReminders({ today, bodies: [toddler], lastLog: { "b-tod": "2026-08-20" } })).toHaveLength(1);
    expect(weighReminders({ today, bodies: [toddler], lastLog: { "b-tod": "2026-09-10" } })).toEqual([]);
  });

  it("un hijo con cuenta menor de 18 se trata como menor (nunca recibe la meta semanal)", () => {
    const teen: ReminderBody = { id: "b-teen", profileId: "p2", dependentId: null, birthDate: "2011-01-01", goalKg: null };
    const r = weighReminders({ today, bodies: [teen], lastLog: {} });
    expect(r).toEqual([{ kind: "kid", bodyId: "b-teen", personId: "p2", key: "weighkid:b-teen:2026-09" }]);
  });

  it("no avisa por lactantes ni por fichas sin fecha de nacimiento", () => {
    const baby: ReminderBody = { id: "b-baby", profileId: null, dependentId: "d2", birthDate: "2026-03-01", goalKg: null };
    const unknown: ReminderBody = { id: "b-x", profileId: null, dependentId: "d3", birthDate: null, goalKg: null };
    expect(weighReminders({ today, bodies: [baby, unknown], lastLog: {} })).toEqual([]);
  });
});
