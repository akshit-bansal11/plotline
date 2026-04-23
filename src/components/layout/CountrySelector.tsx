"use client";
import { ChevronDown, Globe, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useData } from "@/context/DataContext";
import { cn } from "@/utils";

/* ── Flag image helpers ────────────────────────────────────────────────── */
const FLAG_URL = (code: string) => `https://flagsapi.com/${code}/flat/24.png`;

// Codes that have known flags on flagsapi (all standard ISO-3166-1 alpha-2 used by them)
// We'll attempt to load for every code; onError swaps to globe.

function FlagImg({ code, size = 18 }: { code: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Globe size={size} className="text-neutral-500" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <Image
      src={FLAG_URL(code)}
      alt={code}
      width={size}
      height={size}
      className="object-contain"
      onError={() => setFailed(true)}
    />
  );
}

/* ── Country data ───────────────────────────────────────────────────────── */
const POPULAR_CODES = ["US", "GB", "IN", "CA", "AU", "JP", "DE", "FR", "BR", "KR"];

const ALL_COUNTRIES: { code: string; name: string }[] = [
  { code: "AD", name: "Andorra" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "AF", name: "Afghanistan" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "AL", name: "Albania" },
  { code: "AM", name: "Armenia" },
  { code: "AO", name: "Angola" },
  { code: "AR", name: "Argentina" },
  { code: "AT", name: "Austria" },
  { code: "AU", name: "Australia" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BB", name: "Barbados" },
  { code: "BD", name: "Bangladesh" },
  { code: "BE", name: "Belgium" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BG", name: "Bulgaria" },
  { code: "BH", name: "Bahrain" },
  { code: "BI", name: "Burundi" },
  { code: "BJ", name: "Benin" },
  { code: "BN", name: "Brunei" },
  { code: "BO", name: "Bolivia" },
  { code: "BR", name: "Brazil" },
  { code: "BS", name: "Bahamas" },
  { code: "BT", name: "Bhutan" },
  { code: "BW", name: "Botswana" },
  { code: "BY", name: "Belarus" },
  { code: "BZ", name: "Belize" },
  { code: "CA", name: "Canada" },
  { code: "CD", name: "DR Congo" },
  { code: "CF", name: "Central African Republic" },
  { code: "CG", name: "Congo" },
  { code: "CH", name: "Switzerland" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "CL", name: "Chile" },
  { code: "CM", name: "Cameroon" },
  { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },
  { code: "CR", name: "Costa Rica" },
  { code: "CU", name: "Cuba" },
  { code: "CV", name: "Cape Verde" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DE", name: "Germany" },
  { code: "DJ", name: "Djibouti" },
  { code: "DK", name: "Denmark" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" },
  { code: "DZ", name: "Algeria" },
  { code: "EC", name: "Ecuador" },
  { code: "EE", name: "Estonia" },
  { code: "EG", name: "Egypt" },
  { code: "ER", name: "Eritrea" },
  { code: "ES", name: "Spain" },
  { code: "ET", name: "Ethiopia" },
  { code: "FI", name: "Finland" },
  { code: "FJ", name: "Fiji" },
  { code: "FM", name: "Micronesia" },
  { code: "FR", name: "France" },
  { code: "GA", name: "Gabon" },
  { code: "GB", name: "United Kingdom" },
  { code: "GD", name: "Grenada" },
  { code: "GE", name: "Georgia" },
  { code: "GH", name: "Ghana" },
  { code: "GM", name: "Gambia" },
  { code: "GN", name: "Guinea" },
  { code: "GQ", name: "Equatorial Guinea" },
  { code: "GR", name: "Greece" },
  { code: "GT", name: "Guatemala" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HN", name: "Honduras" },
  { code: "HR", name: "Croatia" },
  { code: "HT", name: "Haiti" },
  { code: "HU", name: "Hungary" },
  { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IN", name: "India" },
  { code: "IQ", name: "Iraq" },
  { code: "IR", name: "Iran" },
  { code: "IS", name: "Iceland" },
  { code: "IT", name: "Italy" },
  { code: "JM", name: "Jamaica" },
  { code: "JO", name: "Jordan" },
  { code: "JP", name: "Japan" },
  { code: "KE", name: "Kenya" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "KH", name: "Cambodia" },
  { code: "KI", name: "Kiribati" },
  { code: "KM", name: "Comoros" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "KP", name: "North Korea" },
  { code: "KR", name: "South Korea" },
  { code: "KW", name: "Kuwait" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "LA", name: "Laos" },
  { code: "LB", name: "Lebanon" },
  { code: "LC", name: "Saint Lucia" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LK", name: "Sri Lanka" },
  { code: "LR", name: "Liberia" },
  { code: "LS", name: "Lesotho" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "LV", name: "Latvia" },
  { code: "LY", name: "Libya" },
  { code: "MA", name: "Morocco" },
  { code: "MC", name: "Monaco" },
  { code: "MD", name: "Moldova" },
  { code: "ME", name: "Montenegro" },
  { code: "MG", name: "Madagascar" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MK", name: "North Macedonia" },
  { code: "ML", name: "Mali" },
  { code: "MM", name: "Myanmar" },
  { code: "MN", name: "Mongolia" },
  { code: "MR", name: "Mauritania" },
  { code: "MT", name: "Malta" },
  { code: "MU", name: "Mauritius" },
  { code: "MV", name: "Maldives" },
  { code: "MW", name: "Malawi" },
  { code: "MX", name: "Mexico" },
  { code: "MY", name: "Malaysia" },
  { code: "MZ", name: "Mozambique" },
  { code: "NA", name: "Namibia" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "NI", name: "Nicaragua" },
  { code: "NL", name: "Netherlands" },
  { code: "NO", name: "Norway" },
  { code: "NP", name: "Nepal" },
  { code: "NR", name: "Nauru" },
  { code: "NZ", name: "New Zealand" },
  { code: "OM", name: "Oman" },
  { code: "PA", name: "Panama" },
  { code: "PE", name: "Peru" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "PH", name: "Philippines" },
  { code: "PK", name: "Pakistan" },
  { code: "PL", name: "Poland" },
  { code: "PS", name: "Palestine" },
  { code: "PT", name: "Portugal" },
  { code: "PW", name: "Palau" },
  { code: "PY", name: "Paraguay" },
  { code: "QA", name: "Qatar" },
  { code: "RO", name: "Romania" },
  { code: "RS", name: "Serbia" },
  { code: "RU", name: "Russia" },
  { code: "RW", name: "Rwanda" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SB", name: "Solomon Islands" },
  { code: "SC", name: "Seychelles" },
  { code: "SD", name: "Sudan" },
  { code: "SE", name: "Sweden" },
  { code: "SG", name: "Singapore" },
  { code: "SI", name: "Slovenia" },
  { code: "SK", name: "Slovakia" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SM", name: "San Marino" },
  { code: "SN", name: "Senegal" },
  { code: "SO", name: "Somalia" },
  { code: "SR", name: "Suriname" },
  { code: "SS", name: "South Sudan" },
  { code: "ST", name: "São Tomé and Príncipe" },
  { code: "SV", name: "El Salvador" },
  { code: "SY", name: "Syria" },
  { code: "SZ", name: "Eswatini" },
  { code: "TD", name: "Chad" },
  { code: "TG", name: "Togo" },
  { code: "TH", name: "Thailand" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TL", name: "Timor-Leste" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TN", name: "Tunisia" },
  { code: "TO", name: "Tonga" },
  { code: "TR", name: "Turkey" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "TV", name: "Tuvalu" },
  { code: "TW", name: "Taiwan" },
  { code: "TZ", name: "Tanzania" },
  { code: "UA", name: "Ukraine" },
  { code: "UG", name: "Uganda" },
  { code: "US", name: "United States" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "VA", name: "Vatican City" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Vietnam" },
  { code: "VU", name: "Vanuatu" },
  { code: "WS", name: "Samoa" },
  { code: "YE", name: "Yemen" },
  { code: "ZA", name: "South Africa" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
];

const POPULAR_COUNTRIES = POPULAR_CODES.map((code) =>
  ALL_COUNTRIES.find((c) => c.code === code),
).filter((c): c is (typeof ALL_COUNTRIES)[number] => Boolean(c));

/* ── Component ─────────────────────────────────────────────────────────── */
export function CountrySelector() {
  const { selectedCountry, setSelectedCountry } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect country on first visit (only if nothing saved)
  useEffect(() => {
    if (selectedCountry) return; // already chosen
    let cancelled = false;
    fetch("https://ipapi.co/json/")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const code = data?.country_code;
        if (code && ALL_COUNTRIES.some((c) => c.code === code)) {
          setSelectedCountry(code);
        }
      })
      .catch(() => {
        /* silently ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCountry, setSelectedCountry]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const selectCountry = useCallback(
    (code: string | null) => {
      setSelectedCountry(code);
      setIsOpen(false);
    },
    [setSelectedCountry],
  );

  const selected = ALL_COUNTRIES.find((c) => c.code === selectedCountry);

  const lowerSearch = search.toLowerCase().trim();
  const filteredCountries = lowerSearch
    ? ALL_COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(lowerSearch) || c.code.toLowerCase().includes(lowerSearch),
      )
    : ALL_COUNTRIES;

  return (
    <div ref={containerRef} className="relative z-50">
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/40 px-3 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-900/60"
      >
        {selected ? (
          <FlagImg code={selected.code} size={16} />
        ) : (
          <>
            <Globe size={14} className="text-neutral-400" />
            <span className="hidden sm:inline">Country</span>
          </>
        )}
        <ChevronDown
          size={12}
          className={cn("text-neutral-500 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-[calc(100%+8px)] w-64 overflow-hidden rounded-xl border border-white/10 bg-neutral-950/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Search box */}
            <div className="p-2">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
                />
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search countries…"
                  className="w-full rounded-lg bg-neutral-800/60 border border-white/5 py-1.5 pl-8 pr-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 transition-colors"
                />
              </div>
            </div>

            <div className="px-1 pb-1">
              {/* Global option */}
              <button
                type="button"
                onClick={() => selectCountry(null)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-white/5",
                  !selectedCountry ? "bg-white/10 text-white" : "text-neutral-400",
                )}
              >
                <Globe size={14} />
                <span>Global / No Selection</span>
              </button>

              {/* Popular countries (only when not searching) */}
              {!lowerSearch && (
                <>
                  <div className="my-1.5 flex items-center gap-2 px-3">
                    <div className="h-px flex-1 bg-white/5" />
                    <span className="text-[9px] uppercase tracking-widest text-neutral-600">
                      Popular
                    </span>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>
                  {POPULAR_COUNTRIES.map((country) => (
                    <button
                      type="button"
                      key={`pop-${country.code}`}
                      onClick={() => selectCountry(country.code)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-white/5",
                        selectedCountry === country.code
                          ? "bg-white/10 text-white"
                          : "text-neutral-400",
                      )}
                    >
                      <FlagImg code={country.code} size={16} />
                      <span>{country.name}</span>
                    </button>
                  ))}
                  <div className="my-1.5 flex items-center gap-2 px-3">
                    <div className="h-px flex-1 bg-white/5" />
                    <span className="text-[9px] uppercase tracking-widest text-neutral-600">
                      All
                    </span>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>
                </>
              )}

              {/* Full list */}
              <div className="max-h-52 overflow-y-auto custom-scrollbar">
                {filteredCountries.length === 0 ? (
                  <div className="py-4 text-center text-xs text-neutral-500">
                    No countries found
                  </div>
                ) : (
                  filteredCountries.map((country) => (
                    <button
                      type="button"
                      key={country.code}
                      onClick={() => selectCountry(country.code)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-white/5",
                        selectedCountry === country.code
                          ? "bg-white/10 text-white"
                          : "text-neutral-400",
                      )}
                    >
                      <FlagImg code={country.code} size={16} />
                      <span>{country.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
