# Minesweeper World

Minesweeper in the browser: singleplayer, live multiplayer rooms, a daily challenge, leaderboards, levels and
badges, and a replay of every game the server ran. It runs at https://minesweeper.wooasi.com.

## Features

- Singleplayer on the classic boards or any size, with themes, win and loss animations and sounds
- Boards that never need a guess: every one can be cleared from its first click by reasoning alone. Classic
  Minesweeper, with the mines wherever chance puts them, is a switch away
- Multiplayer rooms: everyone races the same board, with ratings, spectating and a room chat
- A daily challenge, the same board for everyone
- Leaderboards, levels, experience and badges
- A match history, with every game played back move by move
- Fair play: the server runs every ranked game, so the mines never reach the browser until a game is over
- One layout for desktop, tablet and phone, with touch controls

## Tech stack

- The site (`src/`): React 19, TypeScript, Tailwind CSS 4, Vite
- The API (`server/`): Hono, WebSockets, Better Auth, Drizzle ORM, Postgres
- The rules both sides play by (`shared/`): the board engine, the game modes, the running of a game, the protocol
- The board generator (`crates/boardgen/`): Rust, with no dependencies, run by both sides as WebAssembly
- Tests: Vitest, with Testing Library for the parts that need a page; `cargo test` for the Rust

## How the code is laid out

The game is built in layers, each of which only knows about the ones under it.

```
crates/boardgen/  The board generator, in Rust: lays the mines, and plays every board through to make sure it
                  can be cleared without a guess. Run as WebAssembly (see "Board generation" below)

shared/engine/    The board. Plain data and pure functions, nothing else:
  seed.ts           what a board is made from
  generate.ts       where the mines go: asks the generator
  boardgen.ts       the door to the generator, and boardgen.wasm.ts, the generator itself as it is run
  field.ts          a field of mines, and the numbers that follow from it
  board.ts          a board being played: uncover, chord, flag, and what a mine does
  analysis.ts       how many clicks a board needs (3BV), how far along a player is
  view.ts           a board as its player sees it: what is sent, and what is drawn

shared/game/      Games.
  modes.ts          every game there is, and the rules each is played by
  boards.ts         the classic boards
  game.ts           a game being played: its players, its clock, its record. Run by the server for every
                    game that counts, and by the browser for someone playing without an account

shared/protocol.ts  what the browser and the server say to each other

server/src/
  lobby/            who is connected and what they are doing: rooms, games played alone, chat, the socket
  modes/            the server's half of each game: how it starts, and what comes of its results
  scoring.ts        what a game is worth: experience, ratings, whether a result can be believed
  ledger.ts         everything the games keep in the database, behind one interface
  routes.ts         the HTTP API: profiles, leaderboards, match history, admin

src/
  lib/              the site's own logic, free of React: the connection's state, the board as it is drawn,
                    replays, the layout rules
  hooks/            that logic wired into React: the connection, the singleplayer game, touch input
  context/          what the whole app shares: the account, the connection, settings, the theme
  components/       what is on the screen
```

A board is kept flat: one byte per cell, row after row, in a typed array, and a cell is known by its place in it.
A move copies those bytes and changes the copy, so every board of a game can be kept for playing it back.

### Adding a game mode

A mode is two small definitions, and the rest of the app follows from them.

1. **Its rules**, in `shared/game/modes.ts`: an entry in `GAME_MODES` saying where it is played (alone, or in a
   room) and how: what a mine does, how the board is opened, whether the mines are shown afterwards, whether
   stragglers are put on a clock, whether its boards are made to need no guess. The engine, the server's running
   of the game, the site's drawing of it and its replays all go by these.
2. **What the server does with it**, in `server/src/modes/`: a file like `singleplayer.ts` or `race.ts` that starts a
   game of it and says what comes of the results (experience, a leaderboard time, ratings, the record kept), then
   one line in `modes/index.ts`. Leaving this out doesn't compile.

A rule the engine doesn't have yet (a new thing a mine can do, say) is added to `Rules` and to the one place that
plays moves, `press` in `shared/engine/board.ts`. A mode that keeps a new kind of result adds what it needs to
`Ledger` (`server/src/ledger.ts`). The record of every game says which mode it was (`game_record.mode`), so
match history and replays need nothing.

What a new mode does not get for free is somewhere to choose it. A room's host can already change the room's
mode (`setMode`) but has no button for it while there is only one. The singleplayer page plays one of two:

- **No guessing** (`noGuess`), unless the player says otherwise: every board can be cleared by reasoning alone.
- **Classic** (`classic`): Minesweeper as it has always been, with the mines wherever chance puts them. It is what
  the "No guessing" switch turns on when it is switched off: in the board options, behind the last button of the
  bar under a fresh board (`GameDock.tsx`), where the size of the board is chosen too. With it off, that button
  shows dice, and the status bar is headed "Classic".

The two are alike in everything else, and are one definition on the server (`modes/singleplayer.ts`). Which of
the two a game was is kept with its record and its result (`game_record.mode`, `game_result.mode`) and shown in
the match history, and each has leaderboards of its own. Every game from before there was a choice was a classic
one, and is recorded as such. A third singleplayer game will want something more than a switch to choose it with.

### Board generation

Boards are made by `crates/boardgen`, a small Rust program with no dependencies. The server and the browser both
run it as WebAssembly, so a game played without an account gets its boards from the very same code as a ranked
one. A board is made at the first click (or, for a board that is dealt, when the game starts), and takes well
under a thousandth of a second: about 0.15 ms for an Expert board, and never more than a few milliseconds for
any board that can be asked for.

What it promises:

- **A board is its seed.** The same settings, 16-byte seed and opening give the same board, byte for byte,
  wherever it runs. All the chance comes from the seed, through a generator that is nothing but 32-bit integer
  arithmetic (xoshiro128**).
- **The first click is never beside a mine.** The cell a board opens on and the cells around it are kept clear, so
  the opening always uncovers a patch.
- **No guessing, by default.** Every board can be cleared from its opening by reasoning alone. A game mode can
  turn this off (`guessFree: false` in its rules), and then the mines fall wherever chance puts them. One does:
  the classic singleplayer game (below).

How the last of those is kept: the generator has a solver, which plays a board through the way a careful player
would, uncovering only cells it can prove are safe from the numbers showing and the count of mines left. It
reasons in three ways, each stronger and slower than the last, and only reaches for the next when the one before
has nothing more to give: one number at a time; two numbers that share cells; and, where neither gets anywhere,
every way the mines could lie around a group of numbers. A board the solver clears needs no guess. One it gets
stuck on is thrown away and another laid from the same seed, so what comes out is a board picked at random from
among those that need no guess: about nine Beginner boards in ten pass as they are laid, seven Intermediate
ones, and one Expert board in seven.

On a board crowded with mines, far beyond anything the classic boards have, chance would never lay one that
passes. After 64 tries the generator starts helping instead: where the solver stops, the mines around the number
it is stuck on are moved somewhere out of the way and the solver carries on, and a board cleared that way is put
to the solver once more from the start before it is trusted. Every size and mine count the game allows has been
tried (`cargo run --release --example survey sweep`), and a board that needs no guess was found every time. If
one ever isn't, within the work a board is allowed to take, the closest board found is handed over and
`guessFree` on the result says so. (That allowance, `WORK_MAX`, was set with today's limits in mind, 99 by 99 and
99 mines: if they are raised, run the sweep again.)

```
cargo test                               # the generator's own tests
cargo run --release --example survey     # how long boards take, and how often chance alone is enough
npm run build:boardgen                   # build it for the game: writes shared/engine/boardgen.wasm.ts
```

The WebAssembly module is kept in the repository (as base64, in `shared/engine/boardgen.wasm.ts`), so building
the site or the API needs nothing but Node. **After changing anything in `crates/boardgen`, run
`npm run build:boardgen` and commit what it writes.** Forgetting is caught: `crates/boardgen/tests/vectors.json`
holds some four hundred boards the generator is on record as making, the Rust tests hold the source to them, and
`shared/engine/generate.test.ts` holds the module the game runs to the very same ones. Changing what boards come
out is done on purpose or not at all (`cargo run --example vectors > crates/boardgen/tests/vectors.json`), since
it changes every board from then on, the day's daily challenge included.

Building it needs [Rust](https://rustup.rs); `rust-toolchain.toml` says which parts, and rustup fetches them.

## Tests

```
npm test            # everything, once
npm run test:watch  # again on every change
```

The tests sit beside what they test: `shared/` for the board engine and the running of games, `server/src/` for
the lobby, the game modes, scoring, ratings and fair play, and `src/` for the site's own logic, its touch input
and a few of its components. They need no database and no browser: the lobby is tested whole, driven by the
messages a browser would send, with a ledger that keeps everything in memory (`server/src/testing/`).
`src/lib/replay.test.ts` plays games through the same code the server runs and checks that the replay of each
shows exactly what the player saw after every move.

The board generator has tests of its own, in Rust (`cargo test`). The ones that matter most hold its solver to
the slowest and surest way of answering the same question: on boards small enough to try every single way the
mines could lie, it must say a board needs no guess exactly when that is so
(`crates/boardgen/tests/oracle.rs`). While they run, every cell the solver uncovers or marks is also checked
against where the mines really are.

A test that needs a page to work on starts with `// @vitest-environment jsdom`. The same checks run on GitHub
for every push (`.github/workflows/test.yml`), together with the types and the lint rules:

```
npx tsc -b && npm run lint && npm test
npm --prefix server run typecheck
cargo fmt --all --check && cargo clippy --all-targets -- -D warnings && cargo test
```

`npm run lint` also holds the code to one style (two spaces, double quotes, no semicolons); `npm run lint -- --fix`
puts a file right.

## Layout and design

One design on every screen size. The page fills the whole screen, and the app's own pieces are **panes** that float
over it a gap in from the edges, with the page scrolling underneath them.

| | Header | Navigation | A board being played |
| --- | --- | --- | --- |
| **Desktop** (wide, with a mouse) | across the top | the full pane on the left, which folds down to the rail while a board needs the room | the page scrolls; status bar above, dock along the bottom |
| **Tablet**, or a narrow window | across the top | a rail of tabs on the left | the board pans in its own space between a status strip and a dock |
| **Phone** | across the top, slimmer | tabs along the bottom | the same |
| **Phone on its side** | none (the rail carries the logo and the account) | the rail | status and dock go down the right-hand side |

On a phone or tablet, "More" brings up everything the desktop pane holds besides the main pages: global chat, how
to play, themes and settings. What is the signed-in player's own (their profile, their match history, signing out)
is in one place on every layout: the menu behind their picture in the header.

On a touch screen a tap uncovers and holding flags (how long is a setting), the Dig / Flag switch under the board
swaps those two, a board bigger than the screen is dragged about, and two fingers zoom it.

Where to change it:

- `src/hooks/useLayout.ts`: which of the layouts a screen gets, and the widths they change at.
- `src/App.tsx` (`spaces`): the gap around the panes, the height of the header, the width of the rail.
- `src/hooks/useFormStyles.ts`: what a pane, a card and each kind of button look like.
- `src/components/app/Page.tsx`: the margins and width of every page but the singleplayer one.
- `src/components/minesweeper/BoardViewport.tsx`: how big boards are drawn, and when one is shrunk to fit.
- `src/game/themes.ts`: the colours. `DEFAULT_THEME` is what a first visit gets.

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

### A populated demo

To see the site as it would look with people in it (for screenshots, or to try multiplayer alone), with both the
API and the site running:

```sh
npm run demo          # makes 52 made-up players and their games, then puts a dozen of them in live rooms
npm run demo:clear    # removes every made-up player and everything of theirs
```

The first run fills the leaderboards, the daily challenge, profiles and match histories (every game is a real
one, so its replay works). Then the live players open rooms, play each other, chat, and wait in one room for you
to join. They stay until you press Ctrl-C, or for two hours. It only works against a database on your own
machine: the made-up accounts all have addresses ending in `@demo.invalid` (`server/scripts/demo.ts`).

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

Signed-in players hold one WebSocket connection to the API (`/api/ws`) for as long as they are signed in.
The messages that go over it are defined in `shared/protocol.ts`. Everything in `shared/` is used by both the
site and the server, including the rules of the game themselves (`shared/engine/`).

The site says which version of the protocol it speaks as it connects (`PROTOCOL_VERSION`). A page left open
across an update that changed the protocol is told so, and asks to be reloaded, rather than being left half
working. Bump the version whenever a message changes shape.

Rooms live in the server's memory (`server/src/lobby/rooms.ts`), not in the database: a room exists while
players are connected to it, and restarting the API clears them all.

The server runs the games (`shared/game/game.ts`, by the rules of the room's mode). It lays the mines, makes the
same opening click for everyone, and applies every click a player sends. The mines never leave the server: a
player is sent only what they have uncovered themselves, and of the other players only how finished each section
of their board is.

How a race goes (`game.ts`, with the room's side of it in `lobby/rooms.ts` and its results in `modes/race.ts`):

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
  singleplayer. Only games the server ran itself are counted (see "Fair play" below). Each of the two
  singleplayer games has leaderboards of its own, since a time on a board that never needs a guess isn't to be set
  beside one on a board laid by chance. The page shows the ones for the game the player plays, and its
  "No guessing" switch, the same one the game has, shows the other's.
- **The daily challenge** (`#/daily`, `server/src/modes/daily.ts`) is one board a day, the same for everyone,
  run by the server. The board comes from the date mixed with the server's secret, and a player's clock starts
  the first time they start that day's board.
- **Experience, levels and ratings**: what a game is worth is worked out in `server/src/scoring.ts` and awarded by
  each mode (`server/src/modes/`); the level curve and the measure of how hard a board is are in
  `shared/progression.ts`.
- **Badges** are listed in `shared/badges.ts` and worked out in `server/src/badges.ts` from what a player has done.
  `EARLY_SUPPORTER_UNTIL` there is the date to move when the game leaves beta.

### Fair play

Nothing a browser says about a game is taken on trust.

- **The server runs every game of a signed-in player**, singleplayer included. The first click of a singleplayer
  game is sent to the server, which lays the mines around it and keeps them to itself; every click after that is
  sent too (`startSolo` in `shared/protocol.ts`, handled in `lobby/solo.ts`). The server times the game and saves
  the result. Signed out, or with the connection down, singleplayer is played in the browser and nothing is kept.
- **The mines stay on the server.** A player is sent their own board as they see it and nothing under it
  (`ownGame` in `shared/game/game.ts`). Where the mines were is told only once their game is over, and only in a
  game nobody else is playing on the same board: never in a race, never in the day's challenge.
- **A board can't be worked out.** Every board is made from a 128-bit seed drawn from the system's cryptographic
  source, and the day's from the date mixed with the server's secret, so no amount of looking at an opening
  finds the seed behind it. Where a dealt board opens is never the player's to choose.
- **Nothing a browser sends is trusted.** A message is checked for shape before anything reads it
  (`lobby/messages.ts`), and for sense by whatever handles it: is that cell on the board, is it this player's
  game, are they the host.
- **Every game is recorded** in the `game_record` table: the board's layout and each move with its time. A game can
  be played back from that exactly as it went.
- **Limits** (`suspicion` in `server/src/scoring.ts`, and `lobby/moveLimiter.ts`): moves beyond 15 a second are
  thrown away, and a board cleared faster than anyone plays (more than 12 of the clicks it needs per second) is
  kept off the leaderboards and earns nothing. Such games are listed on the admin screen.
- **Admins** can take a player's results off a leaderboard (a Remove button on each row, for admins), put them back,
  reset a rating, and ban an account, from the admin screen.
- **Ratings** only move in games in public rooms; a private room is unrated. Playing the same opponent again
  within a day counts for half, then a quarter, then nothing. Once the server can send email (below), only
  accounts with a confirmed email address are rated.

- **Match history** (`#/history`, and `#/history/<player>` for someone else's): those records as a list, each of
  which can be played back in the browser (`src/lib/replay.ts` replays the moves with the same rules the server
  played them by, so it lands on the same board). Any signed-in player can watch anyone's games, except a go at
  today's daily challenge, which would give the board away.

What this doesn't stop: a program that plays at a human pace, or two people sharing what they see. (Now that
boards need no guess, such a program need never lose, where before it would have had to guess like anyone else.)
The aim is that cheating shows up and can be undone, not that it is impossible.

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
