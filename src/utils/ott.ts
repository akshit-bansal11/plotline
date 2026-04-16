// Via SVGL

import EpicLogo from "@/assets/images/game-platforms/epic-games-dark.svg";
import GOGLogo from "@/assets/images/game-platforms/gog-dark.svg";
// Game Platforms
import SteamLogo from "@/assets/images/game-platforms/steam-dark.svg";
import AppleTVLogo from "@/assets/images/ott/apple-tv-plus-dark.svg";
import CrunchyrollLogo from "@/assets/images/ott/crunchyroll.svg";
import DisneyPlusLogo from "@/assets/images/ott/disney-plus.svg";
import HBOMaxLogo from "@/assets/images/ott/hbo-max-dark.svg";
import HuluLogo from "@/assets/images/ott/hulu.svg";
import ParamountLogo from "@/assets/images/ott/paramount.svg";
import PeacockLogo from "@/assets/images/ott/peacock-dark.svg";
// OTTs
import PrimeVideoLogo from "@/assets/images/ott/prime-video-dark.svg";
import { NetflixLogo, PlayStationLogo, XboxLogo } from "@/data/logoSources";

export type OTTProvider = {
  name: string;
  logo: string;
};

// Streaming providers for movies & series (no Crunchyroll)
const STREAMING_PROVIDERS: OTTProvider[] = [
  { name: "Netflix", logo: NetflixLogo },
  { name: "Prime Video", logo: PrimeVideoLogo },
  { name: "Disney+", logo: DisneyPlusLogo },
  { name: "Hulu", logo: HuluLogo },
  { name: "HBO Max", logo: HBOMaxLogo },
  { name: "Apple TV+", logo: AppleTVLogo },
  { name: "Peacock", logo: PeacockLogo },
  { name: "Paramount+", logo: ParamountLogo },
];

// Anime providers include Crunchyroll
const ANIME_PROVIDERS: OTTProvider[] = [
  ...STREAMING_PROVIDERS,
  { name: "Crunchyroll", logo: CrunchyrollLogo },
];

// Game platforms
const GAME_PROVIDERS: OTTProvider[] = [
  { name: "Steam", logo: SteamLogo },
  { name: "GOG", logo: GOGLogo },
  { name: "Epic Games", logo: EpicLogo },
  { name: "PlayStation", logo: PlayStationLogo },
  { name: "Xbox", logo: XboxLogo },
];

function pickProviders(pool: OTTProvider[], title: string, seed: string): OTTProvider[] {
  let hash = 0;
  const str = (title + seed).toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  const rand = Math.abs(hash % 100);
  let count = 0;
  if (rand < 20) count = 0;
  else if (rand < 50) count = 1;
  else if (rand < 80) count = 2;
  else count = 3;

  if (count === 0) return [];

  const available: OTTProvider[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < count; i++) {
    const index = Math.abs((hash >> (i * 3)) % pool.length);
    if (!usedIndices.has(index)) {
      usedIndices.add(index);
      available.push(pool[index]);
    }
  }

  return available;
}

export function getOTTAvailability(
  title: string,
  country: string | null,
  mediaType?: string | null,
): OTTProvider[] {
  // Manga: no badges
  if (mediaType === "manga") return [];

  // Games: show platform badges (country-independent)
  if (mediaType === "game") {
    return pickProviders(GAME_PROVIDERS, title, "game");
  }

  // No country selected: no streaming badges
  if (!country) return [];

  const pool = mediaType === "anime" ? ANIME_PROVIDERS : STREAMING_PROVIDERS;
  return pickProviders(pool, title, country);
}
