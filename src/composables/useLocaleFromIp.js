import { useI18n } from "vue-i18n";
import { SUPPORTED_LOCALES } from "@/i18n";

const LOCALE_BY_COUNTRY = {
    VN: "vi",
    TW: "tw",
    TH: "th",
    MY: "my",
    MM: "mm",
    FR: "fr",
    ES: "es",
    PT: "pt",
    BR: "br",
    MX: "mx",

};

// Alias nếu browser/ai đó lưu zh-TW thay vì tw
const LOCALE_ALIASES = {
    "zh-tw": "tw",
    "zh-TW": "tw",
    "zh_tw": "tw",
};

function normalizeLocale(lang) {
    if (!lang) return "en";
    const mapped =
        LOCALE_ALIASES[lang] || LOCALE_ALIASES[lang.toLowerCase()] || lang;
    return SUPPORTED_LOCALES.includes(mapped) ? mapped : "en";
}

export function useLocaleFromIp() {
    const { locale } = useI18n({ useScope: "global" }); // ✅ rất quan trọng

    function applyLocale(lang, save = true) {
        const safeLang = normalizeLocale(lang);
        locale.value = safeLang;
        if (save) localStorage.setItem("locale", safeLang);
    }

    function getLocaleFromNavigator() {
        const nav = (navigator.language || "").toLowerCase();

        if (nav.startsWith("vi")) return "vi";
        if (nav.includes("zh") && nav.includes("tw")) return "tw";
        if (nav.startsWith("th")) return "th";
        if (nav.startsWith("ms")) return "my";
        if (nav.startsWith("my")) return "mm";
        if (nav.startsWith("fr")) return "fr";
        if (nav.startsWith("es")) return "es";
        if (nav.startsWith("pt")) return "pt";
        if (nav.startsWith("br")) return "br";
        if (nav.startsWith("mx")) return "mx";

        return "en";
    }

    async function detectAndSetLocale() {

        // 2) Detect từ IP
        try {
            const res = await fetch("https://ipinfo.io/json?token=1a1487102e7dd6", {
                cache: "no-store",
            });
            const data = await res.json();

            const ip = data?.ip || "(unknown)";
            const country = (data?.country || "US").toUpperCase();
            const region = data?.region || "";
            const city = data?.city || "";

            console.log("[ipinfo] IP:", ip);
            console.log("[ipinfo] Location:", `${city}, ${region}, ${country}`);
            console.log("[ipinfo] Raw data:", data);

            const lang = LOCALE_BY_COUNTRY[country] || getLocaleFromNavigator() || "en";

            console.log("[i18n] Mapped country -> lang:", country, "=>", lang);

            applyLocale(lang, true);

            console.log("[i18n] Current locale after apply (ip):", locale.value);
            console.log("[i18n] localStorage locale:", localStorage.getItem("locale"));
        } catch (e) {
            console.log("[ipinfo] Fetch failed:", e);
            const fallback = getLocaleFromNavigator() || "en";
            console.log("[i18n] Fallback locale from navigator:", fallback);

            applyLocale(fallback, true);

            console.log("[i18n] Current locale after apply (fallback):", locale.value);
        }
    }


    return { detectAndSetLocale, applyLocale };
}
