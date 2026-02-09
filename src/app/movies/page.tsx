import { MediaGrid } from "@/components/content/media-grid";

const MOVIES = [
    { id: 1, title: "Civil War", image: "https://image.tmdb.org/t/p/w500/sh7Rg8Er3tFcN9BpKIPOMvALgZd.jpg", year: "2024", type: "movie" },
    { id: 2, title: "Godzilla x Kong", image: "https://image.tmdb.org/t/p/w500/tM26baWgY7h1bCLC8gJ5t2au2u.jpg", year: "2024", type: "movie" },
    { id: 3, title: "Kung Fu Panda 4", image: "https://image.tmdb.org/t/p/w500/kDp1vUBnMpe8ak4rjgl3cLELqjU.jpg", year: "2024", type: "movie" },
    { id: 4, title: "Dune", image: "https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg", year: "2021", type: "movie" },
    { id: 5, title: "Blade Runner 2049", image: "https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg", year: "2017", type: "movie" },
    { id: 6, title: "Interstellar", image: "https://image.tmdb.org/t/p/w500/gEU2QniL6C8zt747TxIjeskOdBS.jpg", year: "2014", type: "movie" },
    { id: 7, title: "Oppenheimer", image: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", year: "2023", type: "movie" },
    { id: 8, title: "The Batman", image: "https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50x9T2Zum8.jpg", year: "2022", type: "movie" },
    { id: 9, title: "Inception", image: "https://image.tmdb.org/t/p/w500/9gk7admal4ZLVD9RcZ3IM0lyqs1.jpg", year: "2010", type: "movie" },
    { id: 10, title: "The Dark Knight", image: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg", year: "2008", type: "movie" },
];

export default function MoviesPage() {
    return (
        <div className="container mx-auto px-4 md:px-6 py-12 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Movies</h1>
                <p className="text-neutral-400">Explore the latest and greatest movies.</p>
            </div>

            <MediaGrid items={MOVIES} />
        </div>
    );
}
