# Minesweeper World

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

### Multiplayer

Signed-in players hold one WebSocket connection to the API (`/api/ws`) while the Multiplayer page is open.
The messages that go over it are defined in `shared/protocol.ts`. Everything in `shared/` is used by both the
site and the server, including the rules of the game themselves (`shared/board.ts`).

Rooms live in the server's memory (`server/src/multiplayer/lobby.ts`), not in the database: a room exists while
players are connected to it, and restarting the API clears them all.

The server runs the games (`server/src/multiplayer/game.ts`). It lays the mines, makes the same opening click for
everyone, and applies every click a player sends. The mines never leave the server: a player is sent only what they
have uncovered themselves, and of the other players only how finished each section of their board is.

### Scores, levels and badges

- **Leaderboards** (`#/leaderboard`) list each player's fastest clear of the classic boards. Multiplayer times are
  checked, because the server runs those games; singleplayer times are whatever the browser reported.
- **The daily challenge** (`#/daily`, `server/src/multiplayer/daily.ts`) is one board a day, the same for everyone,
  run by the server. The board comes from the date mixed with the server's secret, and a player's clock starts
  the first time they start that day's board.
- **Experience, levels and ratings** are awarded in `server/src/progression.ts`; the level curve and the measure of
  how hard a board is are in `shared/progression.ts`.
- **Badges** are listed in `shared/badges.ts` and worked out in `server/src/badges.ts` from what a player has done.
  `EARLY_SUPPORTER_UNTIL` there is the date to move when the game leaves beta.

### Changing the database

Tables are defined in `server/src/db/schema.ts`. After editing it:

```sh
npm run db:generate       # writes a migration into server/drizzle/
npm run db:migrate        # applies it
```

`server/src/db/auth-schema.ts` holds the account tables and is generated; after changing the auth setup in
`server/src/auth.ts`, regenerate it with `npx auth@latest generate --config src/auth.ts --output src/db/auth-schema.ts`.

### Hosting

The site stays on GitHub Pages (`minesweeper.wooasi.com`), which can't run the API. The API and its database run on
[Railway](https://railway.com) at `api.wooasi.com`. Both addresses are under `wooasi.com`, so browsers treat the
sign-in cookie as the site's own. On an unrelated address (such as the one Railway gives out) they would block it.

What does the work:

- `server/Dockerfile` builds the API.
- `railway.json` tells Railway to use it, to bring the database up to date before each new version starts
  (`server/src/scripts/migrate.ts`), and to run exactly one copy that never sleeps: rooms live in that one
  copy's memory. For the same reason it only redeploys when `server/`, `shared/` or `railway.json` change.
  Every deploy of the API empties the rooms and chats, so a change to the site alone doesn't cause one.
- `.github/workflows/static.yml` builds the site with `VITE_API_URL` set to the API's address.
- `.github/workflows/server.yml` builds that same image on GitHub whenever the server changes, and checks that it
  starts and reaches a database. It deploys nothing; it is there to say whether the image works.

Setting it up, once:

1. Push the branch that has `server/` and `railway.json` on it. Don't merge it into `main` yet: that publishes
   the site, which would have no API to talk to. On GitHub, under Actions, "Check the API image" should go green.
2. On Railway, make a project from this GitHub repo and set the service to deploy that branch.
   Add a PostgreSQL database to the project.
3. Give the API service these variables:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `BETTER_AUTH_SECRET` | a new one from `openssl rand -base64 32`, not the one used in development |
   | `BETTER_AUTH_URL` | `https://api.wooasi.com` |
   | `CLIENT_ORIGIN` | `https://minesweeper.wooasi.com` (exactly that: no `/` on the end) |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | the same OAuth client as in development |

   Paste the values bare. Quotes around a value, as a `.env` file allows, would become part of it here.

4. In the service's networking settings add the custom domain `api.wooasi.com`, and add the DNS records Railway
   shows for it where `wooasi.com`'s DNS is managed.
5. On the Google OAuth client add the redirect URI `https://api.wooasi.com/api/auth/callback/google`.
   The OAuth consent screen also has to be published, or only its listed test users can sign in.
6. Check that `https://api.wooasi.com/api/health` answers `{"ok":true}`.
7. Merge into `main`. GitHub Pages rebuilds the site, now pointed at the API. Switch the Railway service to
   deploy `main` as well.

Accounts are separate from the ones in development, so sign up on the live site first. To make that account an
admin, run `set-role` from your machine against the hosted database, using the `DATABASE_PUBLIC_URL` that
Railway shows on the Postgres service:

```sh
cd server
DATABASE_URL="<DATABASE_PUBLIC_URL>" npm run set-role -- someone@example.com admin
```

If the API ever moves to another address, change `VITE_API_URL` in the workflow and `BETTER_AUTH_URL` on the host,
and the redirect URI at Google.

### Not done yet

- Email verification and password reset (both need a way to send email).
- Game results are reported by the browser, so stats can be faked. Anything competitive needs the server to run the game.
