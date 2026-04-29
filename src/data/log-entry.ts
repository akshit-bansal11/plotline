import {
  Disc,
  Gamepad2,
  HardDrive,
  Hexagon,
  Laptop,
  Monitor,
  Smartphone,
  Tablet,
  Terminal,
} from "lucide-react";
import {
  type EntryMediaType,
  type EntryStatus,
  getStatusOptionsForMediaType,
} from "../types/log-entry";

export const PLATFORM_OPTIONS = [
  { id: "Steam", label: "Steam", icon: Monitor },
  { id: "Epic Games", label: "Epic Games", icon: Hexagon },
  { id: "PC Local", label: "PC Local", icon: HardDrive },
  { id: "Physical Disc", label: "Physical Disc", icon: Disc },
  { id: "PS5", label: "PS5", icon: Gamepad2 },
  { id: "PS4", label: "PS4", icon: Gamepad2 },
  { id: "PS3", label: "PS3", icon: Gamepad2 },
  { id: "PS2", label: "PS2", icon: Gamepad2 },
  { id: "PS", label: "PS", icon: Gamepad2 },
  { id: "PSP", label: "PSP", icon: Gamepad2 },
  { id: "PS5 Pro", label: "PS5 Pro", icon: Gamepad2 },
  { id: "Xbox Series X", label: "Xbox Series X", icon: Gamepad2 },
  { id: "Xbox Series S", label: "Xbox Series S", icon: Gamepad2 },
  { id: "Xbox One X", label: "Xbox One X", icon: Gamepad2 },
  { id: "Xbox One S", label: "Xbox One S", icon: Gamepad2 },
  { id: "Xbox One", label: "Xbox One", icon: Gamepad2 },
  { id: "Xbox 360", label: "Xbox 360", icon: Gamepad2 },
  { id: "Xbox", label: "Xbox", icon: Gamepad2 },
  { id: "Switch", label: "Switch", icon: Tablet },
  { id: "Steam Deck", label: "Steam Deck", icon: Tablet },
  { id: "GOG", label: "GOG", icon: Monitor },
  { id: "Android", label: "Android", icon: Smartphone },
  { id: "iOS", label: "iOS", icon: Smartphone },
  { id: "MacOS", label: "MacOS", icon: Laptop },
  { id: "Linux", label: "Linux", icon: Terminal },
];

export const MOVIE_STATUS_OPTIONS = getStatusOptionsForMediaType("movie");
export const SERIES_ANIME_STATUS_OPTIONS = getStatusOptionsForMediaType("series");
export const MANGA_STATUS_OPTIONS = getStatusOptionsForMediaType("manga");
export const GAME_STATUS_OPTIONS = getStatusOptionsForMediaType("game");

export const getLogEntryStatusOptions = (mediaType: EntryMediaType): readonly EntryStatus[] =>
  getStatusOptionsForMediaType(mediaType);

export const STANDARD_STATUS_OPTIONS = SERIES_ANIME_STATUS_OPTIONS;
