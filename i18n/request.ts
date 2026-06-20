import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { isSupportedLocale } from "../lib/locale";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("locale")?.value;
  const locale = isSupportedLocale(cookieLocale) ? cookieLocale : "ro";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
