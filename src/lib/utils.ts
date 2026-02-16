import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const entryStatusLabels = {
    watching: "Watching",
    completed: "Completed",
    plan_to_watch: "Plan to watch",
    on_hold: "On hold",
    dropped: "Dropped",
    unspecified: "Unspecified",
};

export const entryMediaTypeLabels = {
    movie: "Movie",
    series: "Series",
    anime: "Anime",
    anime_movie: "Anime movie",
    manga: "Manga",
    game: "Game",
};
