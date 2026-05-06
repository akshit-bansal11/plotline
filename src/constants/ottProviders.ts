// File: src/constants/ottProviders.ts
// Purpose: OTT streaming provider and game platform constants

// ─── Logos
import EpicLogo from "@/assets/images/game-platforms/epic-games-dark.svg";
import GOGLogo from "@/assets/images/game-platforms/gog-dark.svg";
import SteamLogo from "@/assets/images/game-platforms/steam-dark.svg";
import AppleTVLogo from "@/assets/images/ott/apple-tv-plus-dark.svg";
import CrunchyrollLogo from "@/assets/images/ott/crunchyroll.svg";
import DisneyPlusLogo from "@/assets/images/ott/disney-plus.svg";
import HBOMaxLogo from "@/assets/images/ott/hbo-max-dark.svg";
import HuluLogo from "@/assets/images/ott/hulu.svg";
import ParamountLogo from "@/assets/images/ott/paramount.svg";
import PeacockLogo from "@/assets/images/ott/peacock-dark.svg";
import PrimeVideoLogo from "@/assets/images/ott/prime-video-dark.svg";
import { NetflixLogo, PlayStationLogo, XboxLogo } from "@/data/logoSources";

export type OTTProvider = {
  readonly name: string;
  readonly logo: string;
};

// ─── Streaming Providers
export const STREAMING_PROVIDERS: readonly OTTProvider[] = [
  { name: "Netflix", logo: NetflixLogo },
  { name: "Prime Video", logo: PrimeVideoLogo },
  { name: "Disney+", logo: DisneyPlusLogo },
  { name: "Hulu", logo: HuluLogo },
  { name: "HBO Max", logo: HBOMaxLogo },
  { name: "Apple TV+", logo: AppleTVLogo },
  { name: "Peacock", logo: PeacockLogo },
  { name: "Paramount+", logo: ParamountLogo },
] as const;

// ─── Anime Providers
export const ANIME_PROVIDERS: readonly OTTProvider[] = [
  ...STREAMING_PROVIDERS,
  { name: "Crunchyroll", logo: CrunchyrollLogo },
] as const;

// ─── Game Platforms
export const GAME_PROVIDERS: readonly OTTProvider[] = [
  { name: "Steam", logo: SteamLogo },
  { name: "GOG", logo: GOGLogo },
  { name: "Epic Games", logo: EpicLogo },
  { name: "PlayStation", logo: PlayStationLogo },
  { name: "Xbox", logo: XboxLogo },
] as const;
