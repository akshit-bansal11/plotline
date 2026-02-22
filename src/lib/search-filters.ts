export type ApiBaseType = "movie" | "series" | "anime" | "manga" | "game";
export type ApiSearchType = ApiBaseType | "anime_movie";
export type ApiSearchStatus = "finished" | "airing" | "tba" | "not_yet_aired";

export type YearFilterOption = {
    id: string;
    label: string;
    min: number;
    max: number;
};

export const GLOBAL_SEARCH_TYPE_OPTIONS: Array<{ value: ApiSearchType; label: string }> = [
    { value: "movie", label: "Movie" },
    { value: "series", label: "Series" },
    { value: "anime", label: "Anime" },
    { value: "anime_movie", label: "Anime Movie" },
    { value: "manga", label: "Manga" },
    { value: "game", label: "Game" },
];

export const GLOBAL_SEARCH_SUBTYPE_OPTIONS: Partial<Record<ApiSearchType, Array<{ value: string; label: string }>>> = {
    movie: [{ value: "short_movie", label: "Short Movie" }],
    anime: [
        { value: "special", label: "Special" },
        { value: "ova", label: "OVA" },
        { value: "ona", label: "ONA" },
    ],
    manga: [
        { value: "manhwa", label: "Manhwa" },
        { value: "manhua", label: "Manhua" },
        { value: "one_shot", label: "One-shot" },
        { value: "light_novel", label: "Light Novel" },
        { value: "novel", label: "Novel" },
        { value: "doujinshi", label: "Doujinshi" },
    ],
};

export const SHARED_GENRE_OPTIONS = [
    "Action",
    "Adventure",
    "Comedy",
    "Drama",
    "Fantasy",
    "Horror",
    "Mystery",
    "Romance",
    "Sci-Fi",
    "Thriller",
] as const;

const GENRE_ALIASES: Record<string, typeof SHARED_GENRE_OPTIONS[number]> = {
    action: "Action",
    adventure: "Adventure",
    comedy: "Comedy",
    drama: "Drama",
    fantasy: "Fantasy",
    horror: "Horror",
    mystery: "Mystery",
    romance: "Romance",
    "science fiction": "Sci-Fi",
    "sci-fi": "Sci-Fi",
    "sci fi": "Sci-Fi",
    "sci_fi": "Sci-Fi",
    thriller: "Thriller",
};

export const normalizeGenreName = (value: string | null | undefined) => {
    if (!value) return null;
    const key = value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
    return GENRE_ALIASES[key] || null;
};

export const SEARCH_STATUS_OPTIONS: Array<{ value: ApiSearchStatus; label: string }> = [
    { value: "finished", label: "Finished" },
    { value: "airing", label: "Airing" },
    { value: "tba", label: "TBA" },
    { value: "not_yet_aired", label: "Not Yet Aired" },
];

const STATUS_ALIASES: Array<{ pattern: RegExp; value: ApiSearchStatus }> = [
    { pattern: /(finished|ended|complete|released|finished airing|finished publishing)/i, value: "finished" },
    { pattern: /(airing|publishing|currently airing|currently publishing|returning|in production|ongoing)/i, value: "airing" },
    { pattern: /(not yet aired|not yet published)/i, value: "not_yet_aired" },
    { pattern: /(planned|announced|tba|to be announced|upcoming)/i, value: "tba" },
];

export const normalizeStatusName = (value: string | null | undefined): ApiSearchStatus | null => {
    if (!value) return null;
    for (const entry of STATUS_ALIASES) {
        if (entry.pattern.test(value)) return entry.value;
    }
    return null;
};

export const ANIME_STUDIO_OPTIONS = [
    "MAPPA",
    "Bones",
    "A-1 Pictures",
    "Aniplex",
    "Ufotable",
    "Studio Ghibli",
    "Wit Studio",
    "Madhouse",
    "Kyoto Animation",
    "Toei Animation",
    "Studio Pierrot",
    "Production I.G.",
    "Studio Trigger",
    "J.C. Staff",
    "Bandai Namco",
    "P.A. Works",
] as const;

const STUDIO_ALIASES: Record<string, typeof ANIME_STUDIO_OPTIONS[number]> = {
    "a-1 pictures": "A-1 Pictures",
    "aniplex": "Aniplex",
    "bandai namco": "Bandai Namco",
    "bones": "Bones",
    "bones film": "Bones",
    "j.c. staff": "J.C. Staff",
    "j c staff": "J.C. Staff",
    "kyoto animation": "Kyoto Animation",
    "madhouse": "Madhouse",
    "mappa": "MAPPA",
    "p.a. works": "P.A. Works",
    "p a works": "P.A. Works",
    "production i.g.": "Production I.G.",
    "production i g": "Production I.G.",
    "studio ghibli": "Studio Ghibli",
    "studio pierrot": "Studio Pierrot",
    "studio trigger": "Studio Trigger",
    "toei animation": "Toei Animation",
    "ufotable": "Ufotable",
    "wit studio": "Wit Studio",
};

export const normalizeStudioName = (value: string | null | undefined) => {
    if (!value) return null;
    const key = value.trim().toLowerCase().replace(/\s+/g, " ");
    return STUDIO_ALIASES[key] || null;
};

export const GAME_PLATFORM_OPTIONS = ["Steam", "Epic", "PlayStation", "Nintendo Switch", "Xbox", "PC", "GOG"] as const;

const PLATFORM_ALIASES: Array<{ pattern: RegExp; value: typeof GAME_PLATFORM_OPTIONS[number] }> = [
    { pattern: /steam/i, value: "Steam" },
    { pattern: /(epic|epic games)/i, value: "Epic" },
    { pattern: /(playstation|\bps\d*\b)/i, value: "PlayStation" },
    { pattern: /(nintendo switch|\bswitch\b)/i, value: "Nintendo Switch" },
    { pattern: /xbox/i, value: "Xbox" },
    { pattern: /gog/i, value: "GOG" },
    { pattern: /(pc|windows|mac|linux)/i, value: "PC" },
];

export const normalizeGamePlatform = (value: string | null | undefined) => {
    if (!value) return null;
    for (const entry of PLATFORM_ALIASES) {
        if (entry.pattern.test(value)) return entry.value;
    }
    return null;
};

export const MANGA_SERIALIZATION_OPTIONS = ["Shonen Jump", "KakaoPage", "Naver Webtoon"] as const;

const SERIALIZATION_ALIASES: Record<string, typeof MANGA_SERIALIZATION_OPTIONS[number]> = {
    "shonen jump": "Shonen Jump",
    "weekly shonen jump": "Shonen Jump",
    "kakaopage": "KakaoPage",
    "naver webtoon": "Naver Webtoon",
    webtoon: "Naver Webtoon",
};

export const normalizeSerializationName = (value: string | null | undefined) => {
    if (!value) return null;
    const key = value.trim().toLowerCase().replace(/\s+/g, " ");
    return SERIALIZATION_ALIASES[key] || null;
};

export const getYearFilterOptions = () => {
    const ranges: YearFilterOption[] = [];
    for (let start = 1900; start <= 1990; start += 10) {
        ranges.push({
            id: `decade_${start}`,
            label: `${start}\u2013${start + 9}`,
            min: start,
            max: start + 9,
        });
    }
    for (let year = 2001; year <= 2026; year += 1) {
        ranges.push({
            id: `year_${year}`,
            label: String(year),
            min: year,
            max: year,
        });
    }
    return ranges;
};

const MAL_ANIME_SUBTYPE_ALIASES: Record<string, string> = {
    tv: "tv",
    movie: "movie",
    ova: "ova",
    ona: "ona",
    special: "special",
};

const MAL_MANGA_SUBTYPE_ALIASES: Record<string, string> = {
    manga: "manga",
    manhwa: "manhwa",
    manhua: "manhua",
    one_shot: "one_shot",
    one: "one_shot",
    "one-shot": "one_shot",
    light_novel: "light_novel",
    novel: "novel",
    doujinshi: "doujinshi",
};

export const normalizeSubtype = (type: ApiBaseType, value: string | null | undefined) => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase().replace(/[-\s]+/g, "_");

    if (type === "movie") {
        return normalized === "short_movie" ? "short_movie" : null;
    }

    if (type === "anime") {
        return MAL_ANIME_SUBTYPE_ALIASES[normalized] || null;
    }

    if (type === "manga") {
        return MAL_MANGA_SUBTYPE_ALIASES[normalized] || null;
    }

    return null;
};

export const getBaseTypeFromSearchType = (type: ApiSearchType | null): ApiBaseType | null => {
    if (!type) return null;
    if (type === "anime_movie") return "anime";
    return type;
};
