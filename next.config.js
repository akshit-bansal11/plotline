module.exports = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "ia.media-imdb.com" },
      { protocol: "https", hostname: "img.omdbapi.com" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.igdb.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
  async redirects() {
    return [
      { source: "/movies", destination: "/#movies", permanent: false },
      { source: "/series", destination: "/#series", permanent: false },
      { source: "/anime", destination: "/#anime", permanent: false },
      { source: "/manga", destination: "/#manga", permanent: false },
      { source: "/games", destination: "/#games", permanent: false },
    ];
  },
};
