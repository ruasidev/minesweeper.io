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

How a game goes (`game.ts`, with the room's side of it in `lobby.ts`):

- Uncovering a mine doesn't end a player's game. The mine goes off: everything they had uncovered within a few
  cells of it is covered again (`mineBlastRadius`), and they sit out for a moment (`MINE_COOLDOWN_MS`).
- A player's game ends when they clear the board, give up, leave the room, or are stopped. Once at least half of
  the players who haven't given up or left have cleared the board, the rest get a time limit that grows with the
  size of the board (`finishTimeMs`), and are stopped when it runs out. The host can also stop everyone.
- The game is over once nobody is playing. Experience and ratings are settled then, and the rating changes are
  sent out with the results. The finished game stays with the room, for its results, until the next one starts.
- A player whose own game is over sees the results, can go back to the room while the others play on, and can
  watch any player's board. Someone still playing can't: everyone has the same board.

### Scores, levels and badges

- **Leaderboards** (`#/leaderboard`) list each player's fastest clear of the classic boards, in multiplayer and in
  singleplayer. Only games the server ran itself are counted (see "Fair play" below).
- **The daily challenge** (`#/daily`, `server/src/multiplayer/daily.ts`) is one board a day, the same for everyone,
  run by the server. The board comes from the date mixed with the server's secret, and a player's clock starts
  the first time they start that day's board.
- **Experience, levels and ratings** are awarded in `server/src/progression.ts`; the level curve and the measure of
  how hard a board is are in `shared/progression.ts`.
- **Badges** are listed in `shared/badges.ts` and worked out in `server/src/badges.ts` from what a player has done.
  `EARLY_SUPPORTER_UNTIL` there is the date to move when the game leaves beta.

### Fair play

Nothing a browser says about a game is taken on trust.

- **The server runs every game of a signed-in player**, singleplayer included. The first click of a singleplayer
  game is sent to the server, which lays the mines around it and keeps them to itself; every click after that is
  sent too (`soloStart` in `shared/protocol.ts`, handled in `lobby.ts`). The server times the game and saves the
  result. Signed out, or with the connection down, singleplayer is played in the browser and nothing is kept.
- **Every game is recorded** in the `game_record` table: the board's layout and each move with its time. A game can
  be played back from that exactly as it went.
- **Limits** (`server/src/records.ts`, and `allowMove` in `lobby.ts`): moves beyond 15 a second are thrown away, and
  a board cleared faster than anyone plays (more than 12 of the clicks it needs per second) is kept off the
  leaderboards and earns nothing. Such games are listed on the admin screen.
- **Admins** can take a player's results off a leaderboard (a Remove button on each row, for admins), put them back,
  reset a rating, and ban an account, from the admin screen.
- **Ratings** only move in games in public rooms; a private room is unrated. Playing the same opponent again
  within a day counts for half, then a quarter, then nothing. Once the server can send email (below), only
  accounts with a confirmed email address are rated.

- **Match history** (`#/history`, and `#/history/<player>` for someone else's): those records as a list, each of
  which can be played back in the browser (`src/lib/replay.ts` replays the moves with the same rules the server
  played them by, so it lands on the same board). Any signed-in player can watch anyone's games, except a go at
  today's daily challenge, which would give the board away.

What this doesn't stop: a program that plays at a human pace, or two people sharing what they see. The aim is that
cheating shows up and can be undone, not that it is impossible.

### Email

The server sends email through [Resend](https://resend.com) once `RESEND_API_KEY` and `EMAIL_FROM` are set
(`server/.env` here, the variables on Railway when hosted). `EMAIL_FROM` is the sender, such as
`Minesweeper World <noreply@wooasi.com>`, and has to be on a domain that has been verified in Resend. With both
set, an account made with an email and password is sent a link to confirm the address, and unconfirmed accounts
are left out of ratings. Without them no email is sent and nothing depends on it. When it is switched on, add
Resend to the services listed in the privacy policy (`public/privacy.html`).

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
- The image brings the database up to date every time it starts (`server/src/scripts/migrate.ts`), then
  starts the API.
- `railway.json` tells Railway to use that image and to run exactly one copy that never sleeps: rooms live in
  that one copy's memory. For the same reason it only redeploys when `server/`, `shared/` or `railway.json` change.
  Every deploy of the API empties the rooms and chats, so a change to the site alone doesn't cause one.
- `.github/workflows/static.yml` builds the site with `VITE_API_URL` set to the API's address.
- `.github/workflows/server.yml` builds that same image on GitHub whenever the server changes, and checks that it
  starts and reaches a database. It deploys nothing; it is there to say whether the image works.

Setting it up, once:

1. Push the branch that has `server/` and `railway.json` on it. Don't merge it into `main` yet: that publishes
   the site, which would have no API to talk to. On GitHub, under Actions, "Check the API image" should go green.
2. On Railway, make a project from this GitHub repo and pick that branch. It appears as one box on the
   project's canvas, and its first deploy fails: it has no database or settings yet.
3. Add the database: **+ Create** at the top right of the canvas (or right-click the canvas), then
   **Database**, then **Add PostgreSQL**. A second box named `Postgres` appears and starts by itself.
4. Give the API its settings: click the API's box, open its **Variables** tab, choose **Raw Editor** and paste
   this, with your own values in the three marked places:

   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   BETTER_AUTH_SECRET=<a new one from: openssl rand -base64 32>
   BETTER_AUTH_URL=https://api.wooasi.com
   CLIENT_ORIGIN=https://minesweeper.wooasi.com
   PORT=3000
   GOOGLE_CLIENT_ID=<from the Google OAuth client>
   GOOGLE_CLIENT_SECRET=<from the Google OAuth client>
   ```

   `${{Postgres.DATABASE_URL}}` is typed exactly like that: Railway fills in the address of the box named
   `Postgres`. Paste the other values bare, since quotes around a value would become part of it, and
   `CLIENT_ORIGIN` must have no `/` on the end. Save, then press **Deploy** on the banner that appears.
   The deploy's log should say `The database is up to date` and then `API listening`.
5. Give it its address: in the API box open **Settings**, then **Networking**, then **Custom Domain**. Enter
   `api.wooasi.com`, and `3000` if it asks for a port. Railway then shows DNS records to add; add them where
   `wooasi.com`'s DNS is managed (the same place the `minesweeper` record for GitHub Pages was added).
6. On the Google OAuth client add the redirect URI `https://api.wooasi.com/api/auth/callback/google`.
   The OAuth consent screen also has to be published, or only its listed test users can sign in.
7. Check that `https://api.wooasi.com/api/health` answers `{"ok":true}`.
8. Merge into `main`. GitHub Pages rebuilds the site, now pointed at the API. Switch the Railway service to
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

`public/privacy.html` and `public/terms.html` are the privacy policy and the terms. They are linked from the
sign-in form and the left pane, and they are the links to give Google for the sign-in screen
(`https://minesweeper.wooasi.com/privacy.html` and `/terms.html`). Keep the policy true: if the site starts
storing or sharing something new, say so there.

### Releasing changes

Pushing to GitHub is all it takes; nothing is done by hand on Railway.

- The site: every push to `main` rebuilds it and publishes it on GitHub Pages.
- The API: Railway follows one branch (set under the service's Settings, Source). A push to that branch that
  changes `server/`, `shared/` or `railway.json` rebuilds and restarts the API, which takes a few minutes and
  empties the rooms and chats. A push that only changes the site leaves the API running.
- The database: commit the migration that `npm run db:generate` writes. The API applies it when it next starts.
- If a new version of the API fails to start, Railway keeps the previous one running and the reason is in the
  deploy's log.
- Settings (the variables) are changed on Railway itself, and take effect after pressing Deploy there.

### Not done yet

- Password reset (the email plumbing for it is there: see "Email").
- A matchmaking queue. Until there is one, "rated" means a game in a public room.
