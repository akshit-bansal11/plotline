# Plotline

> **Plotline has moved into [Lorestep](https://lorestep.akshitbansal.dev/library).** This site now redirects there. Plotline's Firebase data was not migrated.

Plotline is a cinematic media tracking platform for discovering, organizing, and managing movies, series, anime, manga, and games.  
It combines metadata and search results from providers like TMDB, OMDB, MyAnimeList, and Twitch, then lets authenticated users manage personal libraries, lists, and log entries with Firebase-backed auth and data flows.

## Features

- Unified search and metadata enrichment across multiple media providers
- Support for movies, TV series, anime, manga, and games
- Firebase authentication (signup/login/session handling)
- reCAPTCHA + Upstash Redis rate limiting for forgot-password protection
- Personal media library views (dashboard, sections, filtering, list/card views)
- Custom list management (create, view, edit, delete)
- Log entry creation/editing with relation and status tracking
- Profile image uploads via Cloudinary
- API routes for search, metadata lookup, link resolution, and auth flows

## Tech Stack

- **Framework:** Next.js `16.1.6` (App Router)
- **UI:** React `19.2.3`, React DOM `19.2.3`
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4, PostCSS
- **Authentication & Data:** Firebase, Firebase Admin
- **Validation & Utilities:** Zod, Jose, Nookies, clsx, tailwind-merge
- **Media/Data Integrations:** TMDB, OMDB, MyAnimeList (MAL), Twitch, Watchmode
- **Rate Limiting:** Upstash Redis + `@upstash/ratelimit`
- **Media Uploads:** Cloudinary
- **Animation/UI libs:** Motion, Lucide React, React Icons
- **Linting/Formatting:** Biome
- **Testing:** Vitest + Testing Library

## Directory Structure

```text
plotline/
├── public/                    # Static assets
├── src/
│   ├── app/                   # App Router pages, layouts, and API routes
│   │   ├── (app)/             # Main authenticated application screens
│   │   ├── (auth)/            # Authentication screens
│   │   └── api/               # Server routes (search, metadata, auth, etc.)
│   ├── components/            # Reusable UI and feature components
│   ├── containers/            # Page-level/feature containers
│   ├── context/               # React context providers (auth/data/section)
│   ├── providers/             # App-level provider wrappers
│   ├── services/              # Data/service operations
│   ├── lib/                   # SDK clients and shared low-level helpers
│   ├── utils/                 # Utility functions and parsing/filter helpers
│   ├── config/                # App configuration (navigation, constants)
│   ├── states/                # State modules
│   ├── data/                  # Static/data-related resources
│   ├── hooks/                 # Custom React hooks
│   ├── types/                 # Shared TypeScript types
│   └── assets/                # Local fonts/images
├── .env.example               # Environment variable template
├── firestore.rules            # Firestore security rules
├── package.json               # Scripts and dependency manifest
└── README.md
```

## Environment Variables

Create a `.env.local` file in the repository root and copy values from `.env.example`.

### Firebase (Client)

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web app API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |

### Firebase (Admin / Server)

| Variable | Description |
| --- | --- |
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Admin SDK project ID |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Admin service account email |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Admin private key |

### reCAPTCHA v3

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | reCAPTCHA site key used in client auth flows |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA secret used by server verification endpoint |

### Upstash Redis

| Variable | Description |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

### External APIs

| Variable | Description |
| --- | --- |
| `TMDB_API_KEY` | TMDB API key |
| `OMDB_API_KEY` | OMDB API key |
| `MAL_CLIENT_ID` | MyAnimeList client ID |
| `TWITCH_CLIENT_ID` | Twitch client ID |
| `TWITCH_CLIENT_SECRET` | Twitch client secret |
| `WATCHMODE_API` | Watchmode API key |

### Cloudinary

| Variable | Description |
| --- | --- |
| `CLOUDINARY_URL` | Cloudinary connection URL for profile image uploads |

## Running Steps

1. **Clone and enter the repository**
   ```bash
   git clone https://github.com/akshit-bansal11/plotline.git
   cd plotline
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Set environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in all required values in `.env.local`.
4. **Run development server**
   ```bash
   npm run dev
   ```
5. **Open the app**
   - Visit `http://localhost:3000`

### Helpful scripts

```bash
npm run lint       # Biome lint
npm run typecheck  # TypeScript check
npm run test       # Vitest
npm run build      # Production build
```
