import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export default getRequestConfig(async () => {
  // El idioma lo elige cada usuario (se guarda en su perfil y en esta cookie).
  const fromCookie = (await cookies()).get("locale")?.value;
  const fromBrowser = (await headers()).get("accept-language")?.slice(0, 2);
  const locale: Locale = LOCALES.find((l) => l === fromCookie) ?? LOCALES.find((l) => l === fromBrowser) ?? "es";

  return {
    locale,
    timeZone: "America/Lima",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
