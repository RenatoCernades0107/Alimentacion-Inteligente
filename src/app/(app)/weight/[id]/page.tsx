import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { requireMember } from "@/lib/session";
import { daysBetween, todayIn } from "@/lib/dates";
import { bmi as bmiOf, classifyBmi, dailyTarget, trendKg, type Activity, type BodyData, type LogPoint } from "@/lib/body";
import { MemberAvatar } from "@/components/family/member-avatar";
import { Section } from "@/components/page-header";
import { BodyCard } from "@/components/weight/body-card";
import { GoalCard } from "@/components/weight/goal-card";
import { WeightLogCard } from "@/components/weight/weight-log-card";
import { DependentActions } from "@/components/weight/dependent-actions";
import type { BodyRow, Role, WeightLog } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Person = {
  kind: "profile" | "dependent";
  id: string;
  name: string;
  avatar: string | null;
  avatar_url: string | null;
  role: Role | null;
};

const CLASS_KEY = { under: "classUnder", healthy: "classHealthy", over: "classOver", obese: "classObese" } as const;
const ACTIVITY_KEY: Record<Activity, "activitySedentary" | "activityLight" | "activityModerate" | "activityActive" | "activityVeryActive"> = {
  sedentary: "activitySedentary",
  light: "activityLight",
  moderate: "activityModerate",
  active: "activityActive",
  very_active: "activityVeryActive",
};

export default async function WeightPage({ params }: PageProps<"/weight/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, user, family, isParent } = await requireMember();
  const t = await getTranslations("weight");
  const tr = await getTranslations("roles");
  const locale = await getLocale();
  const today = todayIn(family.timezone);

  // La persona (cuenta o integrante sin cuenta). RLS: solo de mi familia. Nunca se usa el cliente admin aquí.
  let person: Person | null = null;
  const { data: account } = await supabase.from("profiles").select("id, full_name, avatar, avatar_url, role").eq("id", id).maybeSingle();
  if (account) {
    person = { kind: "profile", id, name: account.full_name ?? "", avatar: account.avatar, avatar_url: account.avatar_url, role: account.role };
  } else {
    const { data: dep } = await supabase.from("dependents").select("id, name, avatar").eq("id", id).maybeSingle();
    if (dep) person = { kind: "dependent", id, name: dep.name, avatar: dep.avatar, avatar_url: null, role: null };
  }
  if (!person) notFound();

  // Qué puede hacer el usuario con esta ficha lo decide la base de datos (misma regla que las políticas).
  const { data: access } = await supabase.rpc("body_access", {
    p_profile: person.kind === "profile" ? id : null,
    p_dependent: person.kind === "dependent" ? id : null,
  });
  if (access !== "edit" && access !== "view") notFound();
  const canEdit = access === "edit";
  const isSelf = person.id === user.id;

  const { data: bodyRow } = await supabase
    .from("body_profiles")
    .select("*")
    .eq(person.kind === "profile" ? "profile_id" : "dependent_id", id)
    .maybeSingle();
  const body = (bodyRow as BodyRow | null) ?? null;
  const { data: logRows } = body
    ? await supabase.from("weight_logs").select("id, body_id, logged_on, weight_kg, height_cm").eq("body_id", body.id).order("logged_on")
    : { data: [] };
  const logs = ((logRows ?? []) as WeightLog[]).map((l) => ({
    ...l,
    weight_kg: Number(l.weight_kg),
    height_cm: l.height_cm != null ? Number(l.height_cm) : null,
  }));

  const bodyData: BodyData = {
    sex: body?.sex ?? null,
    birthDate: body?.birth_date ?? null,
    heightCm: body?.height_cm != null ? Number(body.height_cm) : null,
    activity: body?.activity ?? "light",
    goalKg: body?.goal_weight_kg != null ? Number(body.goal_weight_kg) : null,
    pace: body?.goal_pace ?? "recommended",
  };
  const points: LogPoint[] = logs.map((l) => ({ on: l.logged_on, kg: l.weight_kg, cm: l.height_cm }));
  const target = dailyTarget(bodyData, points, today);

  const age = target.age;
  const ageLabel = age ? (age.months < 36 ? t("ageMonths", { months: age.months }) : t("age", { years: age.years })) : null;
  const isAdult = !!age && age.years >= 18;
  const lastLog = logs[logs.length - 1];
  const heightCm = target.heightCm;
  const weightKg = lastLog?.weight_kg ?? null;
  const bmiValue = weightKg && heightCm ? bmiOf(weightKg, heightCm) : null;
  const trend = isAdult && logs.length >= 2 ? trendKg(points) : null;
  const staleDays = lastLog ? daysBetween(lastLog.logged_on, today) : 0;

  const title = isSelf ? t("selfTitle") : t("otherTitle", { name: person.name });
  const subtitle = [
    person.kind === "dependent" ? t("dependentTag") : person.role === "parent" ? tr("parentTitle") : person.role === "child" ? tr("childTitle") : null,
    ageLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const bodySummary = [
    body?.sex ? (body.sex === "female" ? t("female") : t("male")) : null,
    ageLabel,
    heightCm ? `${number.format(heightCm)} cm` : null,
    t(ACTIVITY_KEY[bodyData.activity]),
  ]
    .filter(Boolean)
    .join(" · ");

  const goalText = target.plan?.goalKg ?? null;
  const summaryNote =
    target.status === "infant"
      ? t("infantNote")
      : target.status === "incomplete"
        ? t("noteIncomplete")
        : !isAdult
          ? t("noteGrowth")
          : target.plan?.direction === "maintain" || goalText === null
            ? t("noteMaintain")
            : t("noteGoal", { goal: number.format(goalText) });

  return (
    <article className="pb-6">
      <div className="pt-3">
        <Link href="/family" className="-ml-2 inline-flex items-center gap-1 rounded-lg p-2 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> {t("back")}
        </Link>
      </div>

      <header className="flex items-center gap-3 pt-3 pb-1">
        <MemberAvatar member={{ full_name: person.name, avatar: person.avatar, avatar_url: person.avatar_url }} className="size-14" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </header>

      {!canEdit && <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{t("viewOnly")}</p>}

      <section className="mt-4 rounded-2xl border bg-card p-4">
        <div className="text-sm font-medium text-muted-foreground">{t("dailyTarget")}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight tabular-nums">{target.kcal !== null ? target.kcal.toLocaleString(locale) : "—"}</span>
          <span className="text-muted-foreground">{t("kcalPerDay")}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{summaryNote}</p>

        {target.status === "ok" && weightKg !== null && (
          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl bg-muted/60 p-2.5">
              <dt className="text-xs text-muted-foreground">{t("weightNow")}</dt>
              <dd className="font-semibold tabular-nums">{number.format(weightKg)} kg</dd>
              {trend !== null && Math.abs(trend - weightKg) >= 0.1 && (
                <dd className="text-xs text-muted-foreground tabular-nums">{t("trend")} {number.format(trend)}</dd>
              )}
            </div>
            <div className="rounded-xl bg-muted/60 p-2.5">
              <dt className="text-xs text-muted-foreground">{t("bmi")}</dt>
              <dd className="font-semibold tabular-nums">{bmiValue !== null ? number.format(bmiValue) : "—"}</dd>
              {isAdult && bmiValue !== null && age && (
                <dd className="text-xs text-muted-foreground">{t(CLASS_KEY[classifyBmi(bmiValue, age.years)])}</dd>
              )}
            </div>
            <div className="rounded-xl bg-muted/60 p-2.5">
              <dt className="text-xs text-muted-foreground">{t("goal")}</dt>
              <dd className="font-semibold tabular-nums">{goalText !== null ? `${number.format(goalText)} kg` : "—"}</dd>
            </div>
          </dl>
        )}

        {target.status === "ok" && target.stale && staleDays > 0 && (
          <p className="mt-3 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {t("stale", { days: staleDays })}
          </p>
        )}
        {age && age.years < 18 && target.status !== "infant" && <p className="mt-3 text-sm text-muted-foreground">{t("minorNote")}</p>}
      </section>

      <Section title={t("dataTitle")}>
        <BodyCard
          profileId={person.kind === "profile" ? id : null}
          dependentId={person.kind === "dependent" ? id : null}
          initial={{ sex: bodyData.sex, birthDate: bodyData.birthDate, heightCm: bodyData.heightCm, activity: bodyData.activity }}
          needsWeight={logs.length === 0 && target.status !== "infant"}
          canEdit={canEdit}
          today={today}
          summary={bodySummary}
        />
      </Section>

      {isAdult && canEdit && target.status === "ok" && target.weightKg !== null && bodyData.sex && heightCm && body && (
        <Section title={t("goalTitle")}>
          <GoalCard
            key={`${bodyData.goalKg}-${bodyData.pace}-${target.weightKg}`}
            bodyId={body.id}
            sex={bodyData.sex}
            years={age!.years}
            cm={heightCm}
            activity={bodyData.activity}
            savedGoalKg={bodyData.goalKg}
            savedPace={bodyData.pace}
            currentKg={target.weightKg}
            canEdit={canEdit}
            today={today}
          />
        </Section>
      )}

      {body && (
        <Section title={t("logTitle")}>
          <WeightLogCard
            bodyId={body.id}
            logs={logs}
            goalKg={isAdult ? bodyData.goalKg : null}
            canEdit={canEdit}
            today={today}
            askHeight={!isAdult}
            currentHeightCm={heightCm}
          />
        </Section>
      )}

      {person.kind === "dependent" && isParent && (
        <Section title={t("dependentTag")}>
          <DependentActions dependent={{ id: person.id, name: person.name, avatar: person.avatar }} today={today} />
        </Section>
      )}

      <p className="mt-6 text-xs text-muted-foreground">{t("disclaimer")}</p>
    </article>
  );
}
