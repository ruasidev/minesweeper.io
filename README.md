# minesweeper.io

A React + TypeScript implementation of Minesweeper with a panel-based UI inspired by chess.com.  
The game board stays visible on the left, while controls and customization options are in a right-hand panel.

## Features

- Customizable Minesweeper gameplay
- Adjustable rows, columns, and mine count
- Reset button to start fresh
- Stats panel with current game state
- Customizable themes with preset color palettes
- Color picker support for fine-tuned styling
- Responsive layout with scroll support for large boards

## Tech Stack

- React 18
- TypeScript
- Tailwind CSS
- Vite

## Accounts (branch `multiplayer-development`)

The game is a static site. Accounts, profiles and stats come from a small API in `server/`
(Hono, Better Auth and Drizzle on Postgres). Without the API running the game still works; only signing in doesn't.

### Running it locally

You need Postgres running on your machine.

```sh
createdb minesweeper_dev

cd server
npm install
cp .env.example .env      # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:migrate        # creates the tables
npm run dev               # API on http://localhost:3000
```

Then start the site as usual from the repo root with `npm run dev`. The Vite dev server proxies `/api` to the API,
so everything is on `http://localhost:5173`. (`npm run dev:server` from the root also starts the API.)

### Google sign-in

1. Create an OAuth client (type "Web application") at https://console.cloud.google.com/apis/credentials
2. Add the redirect URI `http://localhost:5173/api/auth/callback/google`
3. Put the client ID and secret in `server/.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and restart the API

Until then the "Continue with Google" button reports that Google sign-in isn't set up.

### Admins

Admin accounts get an "Admin" entry in the navigation (the page is at `#/admin`) and an Admin badge next to their name.
To make an account an admin, or a regular user again:

```sh
cd server
npm run set-role -- someone@example.com admin     # or: user
```

### Changing the database

Tables are defined in `server/src/db/schema.ts`. After editing it:

```sh
npm run db:generate       # writes a migration into server/drizzle/
npm run db:migrate        # applies it
```

`server/src/db/auth-schema.ts` holds the account tables and is generated; after changing the auth setup in
`server/src/auth.ts`, regenerate it with `npx auth@latest generate --config src/auth.ts --output src/db/auth-schema.ts`.

### Not done yet

- Hosting. The site deploys to GitHub Pages, which can't run the API. It needs its own host, `VITE_API_URL` set for
  the site build, and cookie settings for the two being on different domains.
- Email verification and password reset (both need a way to send email).
- Game results are reported by the browser, so stats can be faked. Anything competitive needs the server to run the game.
