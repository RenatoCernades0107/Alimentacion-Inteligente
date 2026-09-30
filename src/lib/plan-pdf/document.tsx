import { Circle, Document, Font, Image, Link, Page, Path, Polyline, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { daysBetween, parseDate } from "@/lib/dates";
import type { MealSlot, Unit } from "@/lib/types";
import { CATEGORY_ORDER, formatAmount, formatQuantityUnit, type ShoppingEntry } from "./shopping";
import type { PlanData, PlanMeal } from "./types";

export type Translate = (key: string, values?: Record<string, string | number>) => string;

// Sin guiones al partir palabras: la separación silábica del inglés corta mal el español.
Font.registerHyphenationCallback((word) => [word]);

const COLOR = {
  ink: "#111827",
  body: "#374151",
  muted: "#6b7280",
  faint: "#9ca3af",
  line: "#e5e7eb",
  soft: "#f9fafb",
  brand: "#16a34a",
  brandDark: "#166534",
  brandSoft: "#f0fdf4",
  brandLine: "#bbf7d0",
  warn: "#b45309",
};

/** Mismos colores que las franjas del calendario. */
const SLOT_COLOR: Record<MealSlot, { bg: string; fg: string }> = {
  breakfast: { bg: "#fef3c7", fg: "#b45309" },
  morning_snack: { bg: "#ecfccb", fg: "#4d7c0f" },
  lunch: { bg: "#ffedd5", fg: "#c2410c" },
  afternoon_snack: { bg: "#fce7f3", fg: "#be185d" },
  dinner: { bg: "#e0e7ff", fg: "#4338ca" },
};

/** Las fuentes estándar del PDF solo llevan WinAnsi (Latin-1): lo demás (emojis…) se quita para que no salga roto. */
const NOT_WINANSI = /[^\n -~ -ÿ–—‘’‚“”„†‡•…‰‹›€™ŒœŠšŸŽžƒˆ˜]/g;
const clean = (text: string) => text.normalize("NFC").replace(NOT_WINANSI, "").replace(/ {2,}/g, " ").trim();

/*
 * Interlineado (react-pdf): un `lineHeight` sin unidad se multiplica por el `fontSize` del MISMO estilo (si no
 * lo tiene usa 18), y el resultado en puntos lo heredan todos los descendientes. Por eso:
 *  - solo se pone en textos que pueden ocupar varias líneas, junto a su `fontSize`;
 *  - nunca en la página ni en el encabezado/pie fijos: en los elementos fijos se vuelve a multiplicar en cada
 *    página y a las ~10 páginas el número se desborda y el PDF falla ("unsupported number").
 */
const s = StyleSheet.create({
  page: { paddingTop: 58, paddingBottom: 58, paddingHorizontal: 36, fontFamily: "Helvetica", fontSize: 9, color: COLOR.body },
  fixedTop: { position: "absolute", top: 24, left: 36, right: 36 },
  head: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: COLOR.line },
  foot: { position: "absolute", bottom: 24, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between" },
  fixedTiny: { fontSize: 7.5, color: COLOR.muted },
  tiny: { fontSize: 7.5, lineHeight: 1.3, color: COLOR.muted },
  row: { flexDirection: "row", alignItems: "center" },
  hero: { backgroundColor: COLOR.brand, borderRadius: 14, paddingVertical: 20, paddingHorizontal: 22 },
  heroKicker: { fontSize: 8, letterSpacing: 1.4, color: "#dcfce7", fontFamily: "Helvetica-Bold" },
  heroTitle: { fontSize: 25, lineHeight: 1.15, color: "#ffffff", fontFamily: "Helvetica-Bold", marginTop: 10 },
  heroLine: { fontSize: 11.5, lineHeight: 1.3, color: "#f0fdf4", marginTop: 8 },
  stats: { flexDirection: "row", gap: 10, marginTop: 12 },
  stat: { flex: 1, borderWidth: 1, borderColor: COLOR.line, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  statValue: { fontSize: 20, color: COLOR.brandDark, fontFamily: "Helvetica-Bold" },
  statLabel: { fontSize: 8, color: COLOR.muted, marginTop: 2 },
  h1: { fontSize: 19, color: COLOR.ink, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 11, color: COLOR.ink, fontFamily: "Helvetica-Bold", marginTop: 18, marginBottom: 6 },
  lead: { fontSize: 9, lineHeight: 1.35, color: COLOR.muted, marginTop: 4 },
  note: { fontSize: 8, lineHeight: 1.35, color: COLOR.muted, marginTop: 6 },
  label: { fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, color: COLOR.brandDark },
  chip: { borderRadius: 8, paddingVertical: 2, paddingHorizontal: 6 },
  chipText: { fontSize: 7, fontFamily: "Helvetica-Bold" },
});

const STROKE = { fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Iconos de Lucide (24×24, solo trazo). */
function Icon({ kind, size = 9, color = COLOR.muted }: { kind: "clock" | "users" | "check"; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {kind === "clock" && (
        <>
          <Circle cx="12" cy="12" r="10" stroke={color} {...STROKE} />
          <Polyline points="12 6 12 12 16 14" stroke={color} {...STROKE} />
        </>
      )}
      {kind === "users" && (
        <>
          <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke={color} {...STROKE} />
          <Circle cx="9" cy="7" r="4" stroke={color} {...STROKE} />
          <Path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke={color} {...STROKE} />
          <Path d="M16 3.13a4 4 0 0 1 0 7.75" stroke={color} {...STROKE} />
        </>
      )}
      {kind === "check" && <Polyline points="20 6 9 17 4 12" stroke={color} {...STROKE} strokeWidth={3} />}
    </Svg>
  );
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const dateFormat = (locale: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options });

/** "29 sept – 5 oct 2026"; si los días no son seguidos, se agrega cuántos son. */
function formatPeriod(dates: string[], locale: string, t: Translate) {
  const first = dates[0];
  const last = dates[dates.length - 1];
  const withYear = dateFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  if (first === last) return withYear.format(parseDate(first));
  const from = dateFormat(locale, first.slice(0, 4) === last.slice(0, 4) ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
  const period = `${from.format(parseDate(first))} – ${withYear.format(parseDate(last))}`;
  return daysBetween(first, last) === dates.length - 1 ? period : `${period} · ${t("pdf.daysCount", { count: dates.length })}`;
}

/** "Lunes 29 de septiembre" / "Monday, September 29" */
function dayHeading(date: string, locale: string, t: Translate) {
  const d = parseDate(date);
  return t("pdf.dayHeading", {
    weekday: cap(dateFormat(locale, { weekday: "long" }).format(d)),
    day: d.getUTCDate(),
    month: dateFormat(locale, { month: "long" }).format(d),
  });
}

/** "Lun 29", o "Lun 29 sept" cuando los días son de meses distintos */
function weekdayShort(date: string, locale: string, withMonth: boolean) {
  const d = parseDate(date);
  const label = `${cap(dateFormat(locale, { weekday: "short" }).format(d).replace(".", ""))} ${d.getUTCDate()}`;
  return withMonth ? `${label} ${dateFormat(locale, { month: "short" }).format(d).replace(".", "")}` : label;
}

export function PlanDocument({ data, t }: { data: PlanData; t: Translate }) {
  const { locale, dates, shopping } = data;
  const appName = t("login.title");
  const unitLabel = (u: Unit) => t(`units.${u}`);
  const period = formatPeriod(dates, locale, t);
  const title = data.showPlan ? (shopping ? t("pdf.titleBoth") : t("pdf.titlePlan")) : t("pdf.titleShopping");
  const toBuy = shopping?.entries.filter((e) => e.status === "buy") ?? [];
  const generated = dateFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(parseDate(data.today));

  return (
    <Document title={`${title} – ${period}`} author={appName} creator={appName} language={locale}>
      <Page size="A4" style={s.page}>
        {/* Encabezado en todas las páginas menos la portada */}
        <View
          fixed
          style={s.fixedTop}
          render={({ pageNumber }) =>
            pageNumber === 1 ? null : (
              <View style={s.head}>
                <Text style={[s.fixedTiny, { flexShrink: 1, paddingRight: 12, fontFamily: "Helvetica-Bold", color: COLOR.brand }]}>
                  {appName}
                  <Text style={{ fontFamily: "Helvetica", color: COLOR.muted }}>{`  ·  ${clean(data.familyName)}`}</Text>
                </Text>
                <Text style={[s.fixedTiny, { flexShrink: 0 }]}>{period}</Text>
              </View>
            )
          }
        />
        <View fixed style={s.foot}>
          <Text style={s.fixedTiny}>{t("pdf.generatedOn", { date: generated })}</Text>
          <Text style={s.fixedTiny} render={({ pageNumber, totalPages }) => t("pdf.page", { page: pageNumber, total: totalPages })} />
        </View>

        <View style={s.hero}>
          <Text style={s.heroKicker}>{appName.toUpperCase()}</Text>
          <Text style={s.heroTitle}>{title}</Text>
          <Text style={s.heroLine}>{`${clean(data.familyName)}  ·  ${period}`}</Text>
        </View>

        <View style={s.stats}>
          <Stat value={dates.length} label={t("pdf.statDays")} />
          <Stat value={data.meals.length} label={t("pdf.statMeals")} />
          {shopping && <Stat value={toBuy.length} label={t("pdf.statToBuy")} />}
        </View>

        {data.showPlan && <Overview data={data} t={t} />}
        {shopping && <Shopping data={data} t={t} unitLabel={unitLabel} />}
        {data.showPlan && <Plan data={data} t={t} unitLabel={unitLabel} />}
      </Page>
    </Document>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

/** Una fila por día y una columna por franja: la semana de un vistazo. */
function Overview({ data, t }: { data: PlanData; t: Translate }) {
  const withMonth = new Set(data.dates.map((d) => d.slice(0, 7))).size > 1;
  const dayWidth = withMonth ? 76 : 62;
  return (
    <View>
      <Text style={s.h2}>{t("pdf.overview")}</Text>
      <View style={[s.row, { backgroundColor: COLOR.brandSoft, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 6 }]}>
        <Text style={[s.label, { width: dayWidth }]}>{t("pdf.day").toUpperCase()}</Text>
        {data.slots.map((slot) => (
          <Text key={slot} style={[s.label, { flex: 1, paddingRight: 4, letterSpacing: 0.3 }]}>{t(`slots.${slot}`).toUpperCase()}</Text>
        ))}
      </View>
      {data.dates.map((date, i) => {
        const meals = data.meals.filter((m) => m.date === date);
        return (
          <View key={date} wrap={false} style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 5, paddingHorizontal: 6, backgroundColor: i % 2 ? COLOR.soft : "#ffffff" }}>
            <Text style={{ width: dayWidth, fontFamily: "Helvetica-Bold", color: date === data.today ? COLOR.brand : COLOR.ink }}>{weekdayShort(date, data.locale, withMonth)}</Text>
            {data.slots.map((slot) => {
              const inSlot = meals.filter((m) => m.slot === slot);
              return (
                <View key={slot} style={{ flex: 1, paddingRight: 6 }}>
                  {inSlot.length === 0 ? (
                    <Text style={{ color: COLOR.faint }}>–</Text>
                  ) : (
                    inSlot.map((m) => (
                      <Text key={m.id} style={{ fontSize: 8.5, lineHeight: 1.3, color: m.status === "proposed" ? COLOR.muted : COLOR.ink }}>
                        {clean(m.name) || "–"}
                        {m.status === "proposed" ? ` (${t("pdf.proposedShort")})` : ""}
                      </Text>
                    ))
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function Checkbox() {
  return <View style={{ width: 10, height: 10, borderWidth: 1, borderColor: COLOR.faint, borderRadius: 2.5, marginTop: 1.5 }} />;
}

/** "Ceviche, Lomo saltado, Sopa criolla y 2 más" */
function mealsLabel(meals: string[], t: Translate) {
  const shown = meals.slice(0, 3).map(clean).join(", ");
  return meals.length > 3 ? `${shown} ${t("pdf.andMore", { count: meals.length - 3 })}` : shown;
}

function Shopping({ data, t, unitLabel }: { data: PlanData; t: Translate; unitLabel: (u: Unit) => string }) {
  const shopping = data.shopping!;
  const buy = shopping.entries.filter((e) => e.status === "buy");
  const covered = shopping.entries.filter((e) => e.status === "covered");
  const basics = shopping.entries.filter((e) => e.status === "basic");
  const amounts = (list: ShoppingEntry["buy"]) => list.map((a) => formatAmount(a, unitLabel)).join(" + ");
  const notes = [
    shopping.past > 0 && t("pdf.notePast", { count: shopping.past }),
    shopping.mealsWithoutItems > 0 && t("pdf.noteWithoutItems", { count: shopping.mealsWithoutItems }),
    shopping.proposals > 0 && t("pdf.noteProposals", { count: shopping.proposals }),
  ].filter(Boolean);

  return (
    <View break={data.showPlan}>
      <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-end", marginTop: data.showPlan ? 0 : 18 }]}>
        <Text style={s.h1}>{t("pdf.shoppingTitle")}</Text>
        <Text style={s.tiny}>{t("pdf.productsCount", { count: buy.length })}</Text>
      </View>
      <Text style={s.lead}>{t("pdf.shoppingIntro", { count: shopping.mealCount })}</Text>

      {buy.length === 0 && (
        <View style={{ marginTop: 14, padding: 14, borderRadius: 10, backgroundColor: COLOR.brandSoft, borderWidth: 1, borderColor: COLOR.brandLine }}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: COLOR.brandDark, fontSize: 11 }}>{t("pdf.shoppingNothing")}</Text>
          <Text style={{ marginTop: 3, color: COLOR.body }}>{shopping.mealCount === 0 ? t("pdf.shoppingNoMeals") : t("pdf.shoppingHaveAll")}</Text>
        </View>
      )}

      {CATEGORY_ORDER.map((category) => {
        const entries = buy.filter((e) => e.category === category);
        if (!entries.length) return null;
        return (
          <View key={category} wrap={entries.length > 8}>
            <View minPresenceAhead={70} style={[s.row, { marginTop: 14, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: COLOR.brandLine }]}>
              <Text style={s.label}>{t(`pdf.categories.${category}`).toUpperCase()}</Text>
              <Text style={[s.tiny, { marginLeft: 6 }]}>{entries.length}</Text>
            </View>
            {entries.map((e) => (
              <ShoppingRow key={e.foodId} entry={e} t={t} amounts={amounts} unitLabel={unitLabel} />
            ))}
          </View>
        );
      })}

      {covered.length > 0 && (
        <View>
          <View minPresenceAhead={60} style={[s.row, { marginTop: 18, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: COLOR.line }]}>
            <Icon kind="check" color={COLOR.brand} size={9} />
            <Text style={[s.label, { marginLeft: 5 }]}>{t("pdf.alreadyHave").toUpperCase()}</Text>
            <Text style={[s.tiny, { marginLeft: 6 }]}>{covered.length}</Text>
          </View>
          {covered.map((e) => (
            <View key={e.foodId} wrap={false} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: COLOR.line }}>
              <Text style={{ color: COLOR.ink }}>{clean(e.name)}</Text>
              <Text style={s.tiny}>
                {e.toTaste ? t("pdf.toTaste") : `${t("pdf.need", { amount: amounts(e.needed) })} · ${t("pdf.have", { amount: amounts(e.have) })}`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {basics.length > 0 && (
        <View wrap={false}>
          <View style={[s.row, { marginTop: 18, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: COLOR.line }]}>
            <Text style={s.label}>{t("pdf.basics").toUpperCase()}</Text>
          </View>
          <Text style={[s.tiny, { marginTop: 4 }]}>{t("pdf.basicsHint")}</Text>
          <Text style={{ marginTop: 3, fontSize: 8.5, lineHeight: 1.4 }}>
            {basics.map((e) => (e.toTaste ? clean(e.name) : `${clean(e.name)} (${amounts(e.needed)})`)).join("  ·  ")}
          </Text>
        </View>
      )}

      {notes.map((note, i) => (
        <Text key={i} style={s.note}>{`* ${note}`}</Text>
      ))}
    </View>
  );
}

function ShoppingRow({ entry, t, amounts, unitLabel }: { entry: ShoppingEntry; t: Translate; amounts: (list: ShoppingEntry["buy"]) => string; unitLabel: (u: Unit) => string }) {
  return (
    <View wrap={false} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: COLOR.line }}>
      <Checkbox />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: COLOR.ink }}>
          {clean(entry.name)}
          {entry.optional && <Text style={{ fontFamily: "Helvetica", color: COLOR.muted }}>{`  (${t("pdf.optional")})`}</Text>}
        </Text>
        {entry.have.length > 0 && (
          <Text style={s.tiny}>{`${t("pdf.need", { amount: amounts(entry.needed) })} · ${t("pdf.have", { amount: amounts(entry.have) })}`}</Text>
        )}
        {entry.elsewhere.length > 0 && (
          <Text style={[s.tiny, { color: COLOR.warn }]}>{t("pdf.haveOther", { amount: entry.elsewhere.map((a) => formatAmount(a, unitLabel)).join(" + ") })}</Text>
        )}
        <Text style={s.tiny}>{t("pdf.usedIn", { meals: mealsLabel(entry.meals, t) })}</Text>
      </View>
      <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: entry.buy.length ? COLOR.brandDark : COLOR.muted, maxWidth: 150, textAlign: "right" }}>
        {entry.buy.length ? amounts(entry.buy) : t("pdf.toTaste")}
      </Text>
    </View>
  );
}

function Plan({ data, t, unitLabel }: { data: PlanData; t: Translate; unitLabel: (u: Unit) => string }) {
  return (
    <View break>
      <Text style={s.h1}>{t("pdf.planTitle")}</Text>
      {data.dates.map((date) => {
        const meals = data.meals.filter((m) => m.date === date);
        const [first, ...rest] = meals;
        // Un día sin comidas ocupa una sola línea: así una semana casi vacía no llena páginas.
        if (!first) {
          return (
            <View key={date} wrap={false} style={[s.row, { justifyContent: "space-between", marginTop: 8, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, backgroundColor: COLOR.soft }]}>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: COLOR.muted }}>{dayHeading(date, data.locale, t)}</Text>
              <Text style={s.tiny}>{t("pdf.nothingPlanned")}</Text>
            </View>
          );
        }
        return (
          <View key={date}>
            {/* La barra del día siempre va junto a su primera comida */}
            <View wrap={false}>
              <View style={[s.row, { justifyContent: "space-between", marginTop: 14, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: COLOR.brandSoft, borderLeftWidth: 3, borderLeftColor: COLOR.brand }]}>
                <Text style={{ fontSize: 12.5, fontFamily: "Helvetica-Bold", color: COLOR.brandDark }}>{dayHeading(date, data.locale, t)}</Text>
                <Text style={s.tiny}>
                  {date === data.today ? `${t("pdf.today")}  ·  ` : ""}
                  {t("pdf.mealsCount", { count: meals.length })}
                </Text>
              </View>
              <MealCard meal={first} t={t} unitLabel={unitLabel} />
            </View>
            {rest.map((meal) => (
              <MealCard key={meal.id} meal={meal} t={t} unitLabel={unitLabel} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function Chip({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipText, { color: fg }]}>{text.toUpperCase()}</Text>
    </View>
  );
}

function MealCard({ meal, t, unitLabel }: { meal: PlanMeal; t: Translate; unitLabel: (u: Unit) => string }) {
  const recipe = meal.recipe;
  const steps = recipe?.steps ?? [];
  const color = SLOT_COLOR[meal.slot];
  // Una comida con muchísimos ingredientes o pasos puede no caber en una página: en ese caso se deja partir.
  const oversized = meal.items.length > 28 || steps.join("").length > 2400;
  const name = clean(meal.name) || "–";
  const meta = [
    recipe?.minutes ? { icon: "clock" as const, text: t("pdf.minutes", { count: recipe.minutes }) } : null,
    recipe ? { icon: "users" as const, text: t("pdf.servings", { count: recipe.servings }) } : null,
  ].filter((m) => m !== null);

  return (
    <View wrap={oversized} style={{ marginTop: 8, padding: 10, borderWidth: 1, borderColor: COLOR.line, borderRadius: 10 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {recipe?.photo && (
          <View style={{ width: 132 }}>
            {/* El Image de react-pdf no es un <img>: la foto es decorativa, el nombre del plato ya está al lado. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={{ data: recipe.photo, format: "jpg" }} style={{ width: 132, height: 99, borderRadius: 6 }} />
            {recipe.photoCredit && (
              <Text style={{ fontSize: 5.5, color: COLOR.faint, marginTop: 2 }}>{t("pdf.photoCredit", { author: clean(recipe.photoCredit.author), license: clean(recipe.photoCredit.license) })}</Text>
            )}
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={[s.row, { gap: 5 }]}>
            <Chip text={t(`slots.${meal.slot}`)} bg={color.bg} fg={color.fg} />
            {meal.status === "proposed" && <Chip text={t("pdf.proposed")} bg="#fef3c7" fg="#92400e" />}
            {meal.status === "completed" && <Chip text={t("pdf.completed")} bg={COLOR.brandSoft} fg={COLOR.brandDark} />}
          </View>
          <Text style={{ fontSize: 14, lineHeight: 1.2, fontFamily: "Helvetica-Bold", color: COLOR.ink, marginTop: 6 }}>{name}</Text>
          {recipe && (
            <View style={[s.row, { flexWrap: "wrap", gap: 10, marginTop: 5 }]}>
              {meta.map((m) => (
                <View key={m.icon} style={[s.row, { gap: 3 }]}>
                  <Icon kind={m.icon} />
                  <Text style={s.tiny}>{m.text}</Text>
                </View>
              ))}
              <Text style={s.tiny}>{t(`countries.${recipe.country}`)}</Text>
            </View>
          )}
          {recipe?.description && <Text style={{ marginTop: 6, fontSize: 8.5, lineHeight: 1.35, color: COLOR.muted }}>{clean(recipe.description)}</Text>}
        </View>
      </View>

      {(meal.items.length > 0 || steps.length > 0) && (
        <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
          {meal.items.length > 0 && (
            <View style={{ width: steps.length ? 190 : "100%" }}>
              <Text minPresenceAhead={40} style={s.label}>{t("pdf.ingredients").toUpperCase()}</Text>
              <View style={{ marginTop: 3, flexDirection: "row", flexWrap: "wrap" }}>
                {meal.items.map((item, i) => {
                  const measured = !!item.quantity && !!item.unit;
                  return (
                    <View key={i} wrap={false} style={{ flexDirection: "row", gap: 6, width: steps.length ? "100%" : "50%", paddingVertical: 1.5, paddingRight: steps.length ? 0 : 10 }}>
                      <Text style={{ width: 46, textAlign: "right", fontFamily: measured ? "Helvetica-Bold" : "Helvetica-Oblique", fontSize: measured ? 8.5 : 7.5, color: measured ? COLOR.ink : COLOR.muted }}>
                        {measured ? formatQuantityUnit(item.quantity!, item.unit!, unitLabel) : t("pdf.toTaste")}
                      </Text>
                      <Text style={{ flex: 1, fontSize: 8.5, lineHeight: 1.25 }}>
                        {clean(item.name)}
                        {item.optional && <Text style={{ color: COLOR.muted }}>{` (${t("pdf.optional")})`}</Text>}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
          {steps.length > 0 && (
            <View style={{ flex: 1 }}>
              <Text minPresenceAhead={40} style={s.label}>{t("pdf.steps").toUpperCase()}</Text>
              {steps.map((step, i) => (
                <View key={i} wrap={false} style={{ flexDirection: "row", gap: 6, marginTop: 5 }}>
                  <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: COLOR.brandSoft, borderWidth: 0.75, borderColor: COLOR.brandLine, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: COLOR.brandDark }}>{i + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 9, lineHeight: 1.35 }}>{clean(step)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {recipe?.sourceUrl && (
        <Text style={[s.tiny, { marginTop: 8 }]}>
          {`${t("pdf.source")}: `}
          <Link src={recipe.sourceUrl} style={{ color: COLOR.brand }}>{hostOf(recipe.sourceUrl)}</Link>
        </Text>
      )}
    </View>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
