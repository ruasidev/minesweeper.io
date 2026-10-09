import { and, asc, count, desc, eq, ilike, isNotNull, lt, or, sql } from "drizzle-orm"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { createMiddleware } from "hono/factory"
import { auth } from "./auth.js"
import { badgesOf } from "./badges.js"
import { db } from "./db/index.js"
import { account, avatar, dailyAttempt, gameRecord, gameResult, multiplayerResult, profile, user } from "./db/schema.js"
import { env } from "./env.js"
import { BIO_MAX, USERNAME_PATTERN } from "../../shared/profile.js"
import { STARTING_ELO } from "../../shared/progression.js"
import { BOARD_PRESETS, DAILY_BOARD_SETTINGS } from "../../shared/protocol.js"
import { dailyDate } from "./multiplayer/daily.js"
import { dropPlayer, openRooms } from "./multiplayer/lobby.js"
import { getJoinDate, getOrCreateProfile, getStats, isUsernameTaken } from "./profile.js"

type SessionUser = typeof auth.$Infer.Session.user

// The browser shrinks photos to 256x256 before sending them, so real uploads are far below this
const AVATAR_MAX_BYTES = 512 * 1024

// The image formats accepted as profile photos, by the bytes every file of that format starts with
const AVATAR_TYPES: Record<string, (data: Buffer) => boolean> = {
  "image/jpeg": (data) => data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  "image/png": (data) => data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (data) => data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP",
}

// How many places a leaderboard shows
const LEADERBOARD_SIZE = 50

// Open to everyone: profile photos are shown to other players,
// and visitors who haven't signed in yet get to see which rooms are open
export const publicRoutes = new Hono()
  .get("/rooms", (c) => c.json({ rooms: openRooms() }))

  // The fastest clears of one of the classic boards: every player's best time, quickest first, in multiplayer
  // (the default) or with ?mode=singleplayer. Either way only games the server ran itself are counted, and not
  // the ones kept off the boards (too fast to have been a person, or removed by an admin)
  .get("/leaderboard/:board", async (c) => {
    const preset = BOARD_PRESETS.find(candidate => candidate.id === c.req.param("board"))
    if (!preset) return c.json({ error: "There's no leaderboard for that board" }, 404)
    const { rows, cols, mines } = preset.settings
    const username = sql<string>`coalesce(${profile.username}, ${user.name})`

    // each player's fastest run on this board
    const best = c.req.query("mode") === "singleplayer"
      ? await db.selectDistinctOn([gameResult.userId], {
        userId: gameResult.userId,
        username,
        image: user.image,
        durationMs: sql<number>`${gameResult.durationMs}`.mapWith(Number),
        mineHits: sql<number>`0`.mapWith(Number),
        at: gameResult.createdAt,
      }).from(gameResult)
        .innerJoin(user, eq(user.id, gameResult.userId))
        .leftJoin(profile, eq(profile.userId, user.id))
        .where(and(
          eq(gameResult.rows, rows), eq(gameResult.cols, cols), eq(gameResult.mines, mines),
          eq(gameResult.won, true), eq(gameResult.verified, true), eq(gameResult.hidden, false), isNotNull(gameResult.durationMs),
        ))
        .orderBy(gameResult.userId, asc(gameResult.durationMs))
      : await db.selectDistinctOn([multiplayerResult.userId], {
        userId: multiplayerResult.userId,
        username,
        image: user.image,
        durationMs: multiplayerResult.durationMs,
        mineHits: multiplayerResult.mineHits,
        at: multiplayerResult.createdAt,
      }).from(multiplayerResult)
        .innerJoin(user, eq(user.id, multiplayerResult.userId))
        .leftJoin(profile, eq(profile.userId, user.id))
        .where(and(
          eq(multiplayerResult.rows, rows), eq(multiplayerResult.cols, cols), eq(multiplayerResult.mines, mines),
          eq(multiplayerResult.hidden, false),
        ))
        .orderBy(multiplayerResult.userId, asc(multiplayerResult.durationMs))

    return c.json({ entries: best.sort((a, b) => a.durationMs - b.durationMs).slice(0, LEADERBOARD_SIZE) })
  })

  // Today's challenge: who has cleared it and how fast, and, for a signed-in player, how their own go stands
  .get("/daily", async (c) => {
    const date = dailyDate(Date.now())
    const entries = await db.select({
      userId: dailyAttempt.userId,
      username: sql<string>`coalesce(${profile.username}, ${user.name})`,
      image: user.image,
      durationMs: dailyAttempt.durationMs,
      mineHits: dailyAttempt.mineHits,
      at: dailyAttempt.startedAt,
    }).from(dailyAttempt)
      .innerJoin(user, eq(user.id, dailyAttempt.userId))
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(and(eq(dailyAttempt.date, date), isNotNull(dailyAttempt.durationMs), eq(dailyAttempt.hidden, false)))
      .orderBy(asc(dailyAttempt.durationMs))
      .limit(LEADERBOARD_SIZE)

    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    const [mine] = session
      ? await db.select().from(dailyAttempt).where(and(eq(dailyAttempt.userId, session.user.id), eq(dailyAttempt.date, date)))
      : []

    return c.json({
      date,
      settings: DAILY_BOARD_SETTINGS,
      entries,
      // null if they haven't started today (or aren't signed in); durationMs is null until they have cleared it
      mine: mine ? { startedAt: mine.startedAt.toISOString(), durationMs: mine.durationMs, mineHits: mine.mineHits } : null,
    })
  })
  .get("/avatars/:userId", async (c) => {
    const [photo] = await db.select().from(avatar).where(eq(avatar.userId, c.req.param("userId")))
    if (!photo) return c.notFound()
    return c.body(new Uint8Array(photo.data), 200, {
      "Content-Type": photo.contentType,
      "X-Content-Type-Options": "nosniff",
      // the address changes whenever the photo does, so a copy never needs checking again
      "Cache-Control": "public, max-age=31536000, immutable",
    })
  })

// Everything below needs a signed-in user
const requireUser = createMiddleware<{ Variables: { user: SessionUser } }>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: "Not signed in" }, 401)
  c.set("user", session.user)
  await next()
})

async function profileResponse(account: SessionUser) {
  const { username, bio, xp, elo, gamesStarted, playSeconds } = await getOrCreateProfile(account)
  const joinedAt = await getJoinDate(account.id)
  return {
    username,
    bio,
    xp,
    elo,
    gamesStarted,
    playSeconds,
    badges: await badgesOf({ id: account.id, createdAt: joinedAt, role: account.role }),
    joinedAt: joinedAt.toISOString(),
    stats: await getStats(account.id),
    // Whether their email address is confirmed: "off" while the site sends no email, so nothing depends on it.
    // Until it is confirmed their games don't count towards ratings
    email: !env.emailEnabled ? "off" as const : account.emailVerified ? "confirmed" as const : "unconfirmed" as const,
  }
}

// The admin screen shows at most this many accounts at once; searching narrows it down
const ADMIN_USER_LIMIT = 100

// A role is a comma-separated list, so an account can hold more than one
const isAdmin = (account: { role?: string | null }) => account.role?.split(",").includes("admin") ?? false

// Postgres error code for breaking a unique index; drizzle wraps the driver's error in `cause`
function isUniqueViolation(error: unknown): boolean {
  const code = (e: unknown) => (e as { code?: string } | null)?.code
  return code(error) === "23505" || code((error as { cause?: unknown } | null)?.cause) === "23505"
}

const isIntBetween = (value: unknown, low: number, high: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= low && value <= high

// How many games a page of someone's match history holds
const HISTORY_PAGE = 30

// A player sees all of their own games, and an admin all of anyone's
const seesEverything = (viewer: SessionUser, ownerId: string) => viewer.id === ownerId || isAdmin(viewer)

// Leaves out a go at today's daily challenge (the day being the server's, in UTC)
const notTodaysChallenge = () => sql`not (${gameRecord.kind} = 'daily' and ${gameRecord.createdAt} >= ${dailyDate(Date.now())}::date)`

export const routes = new Hono<{ Variables: { user: SessionUser } }>()
  .use(requireUser)

  // The signed-in player's own profile
  .get("/profile", async (c) => c.json(await profileResponse(c.get("user"))))

  // Another player's profile, as every signed-in player may see it. Their email is not part of it
  .get("/profiles/:userId", async (c) => {
    const [account] = await db.select({ id: user.id, name: user.name, image: user.image, role: user.role, createdAt: user.createdAt })
      .from(user).where(eq(user.id, c.req.param("userId")))
    if (!account) return c.json({ error: "That player doesn't exist" }, 404)

    const { username, bio, xp, elo, gamesStarted, playSeconds } = await getOrCreateProfile(account)
    return c.json({
      id: account.id,
      name: account.name,
      username,
      bio,
      xp,
      elo,
      gamesStarted,
      playSeconds,
      badges: await badgesOf(account),
      image: account.image,
      isAdmin: isAdmin(account),
      joinedAt: account.createdAt.toISOString(),
      stats: await getStats(account.id),
    })
  })

  // Change the username, the bio, or both: whichever of them is sent
  .patch("/profile", async (c) => {
    const account = c.get("user")
    const body = await c.req.json().catch(() => null)
    const changes: { username?: string, bio?: string } = {}

    if (body?.username !== undefined) {
      const username = typeof body.username === "string" ? body.username.trim() : ""
      if (!USERNAME_PATTERN.test(username)) {
        return c.json({ error: "Usernames are 3-20 characters: letters, numbers and underscores" }, 400)
      }
      changes.username = username
    }
    if (body?.bio !== undefined) {
      const bio = typeof body.bio === "string" ? body.bio.trim() : null
      if (bio === null || bio.length > BIO_MAX) return c.json({ error: `Bios are at most ${BIO_MAX} characters` }, 400)
      changes.bio = bio
    }
    if (Object.keys(changes).length === 0) return c.json({ error: "Nothing to change" }, 400)

    await getOrCreateProfile(account)
    if (changes.username && await isUsernameTaken(changes.username, account.id)) return c.json({ error: "That username is taken" }, 409)
    try {
      await db.update(profile).set(changes).where(eq(profile.userId, account.id))
    } catch (error) {
      // someone else took the username between the check and the update
      if (isUniqueViolation(error)) return c.json({ error: "That username is taken" }, 409)
      throw error
    }
    return c.json(await profileResponse(account))
  })

  // Replace the profile photo. The body is the image file itself
  .put(
    "/profile/avatar",
    bodyLimit({ maxSize: AVATAR_MAX_BYTES, onError: (c) => c.json({ error: "That image is too large" }, 413) }),
    async (c) => {
      const account = c.get("user")
      const contentType = c.req.header("Content-Type") ?? ""
      const data = Buffer.from(await c.req.arrayBuffer())
      if (!AVATAR_TYPES[contentType]?.(data)) {
        return c.json({ error: "Profile photos must be JPEG, PNG or WebP images" }, 400)
      }

      await db.insert(avatar).values({ userId: account.id, contentType, data })
        .onConflictDoUpdate({ target: avatar.userId, set: { contentType, data } })
      // a new address every time, so browsers don't keep showing the old photo
      const image = `/api/avatars/${account.id}?v=${Date.now()}`
      await db.update(user).set({ image }).where(eq(user.id, account.id))
      return c.json({ image })
    },
  )

  // A player's match history: the games the server has run for them, newest first, a page at a time. Any signed-in
  // player may look at anyone's. The one thing kept back is someone else's go at today's daily challenge, whose
  // replay would show the board to a player who hasn't played it yet
  .get("/history/:userId", async (c) => {
    const viewer = c.get("user")
    const ownerId = c.req.param("userId")
    const [owner] = await db.select({ id: user.id, username: sql<string>`coalesce(${profile.username}, ${user.name})`, image: user.image })
      .from(user).leftJoin(profile, eq(profile.userId, user.id)).where(eq(user.id, ownerId))
    if (!owner) return c.json({ error: "That player doesn't exist" }, 404)

    const before = Number(c.req.query("before"))
    const games = await db.select({
      id: gameRecord.id,
      kind: gameRecord.kind,
      rated: gameRecord.rated,
      rows: gameRecord.rows,
      cols: gameRecord.cols,
      mines: gameRecord.mines,
      outcome: gameRecord.outcome,
      durationMs: gameRecord.durationMs,
      mineHits: gameRecord.mineHits,
      moves: sql<number>`jsonb_array_length(${gameRecord.moves})`.mapWith(Number),
      at: gameRecord.createdAt,
    }).from(gameRecord)
      .where(and(
        eq(gameRecord.userId, ownerId),
        Number.isInteger(before) && before > 0 ? lt(gameRecord.id, before) : undefined,
        seesEverything(viewer, ownerId) ? undefined : notTodaysChallenge(),
      ))
      .orderBy(desc(gameRecord.id))
      .limit(HISTORY_PAGE + 1)

    return c.json({ player: owner, games: games.slice(0, HISTORY_PAGE), more: games.length > HISTORY_PAGE })
  })

  // One recorded game in full: the board it was played on and every move, for playing it back
  .get("/replays/:id", async (c) => {
    const viewer = c.get("user")
    const id = Number(c.req.param("id"))
    if (!Number.isInteger(id)) return c.json({ error: "That game doesn't exist" }, 404)
    const [game] = await db.select({
      id: gameRecord.id,
      userId: gameRecord.userId,
      username: sql<string>`coalesce(${profile.username}, ${user.name})`,
      image: user.image,
      kind: gameRecord.kind,
      rated: gameRecord.rated,
      rows: gameRecord.rows,
      cols: gameRecord.cols,
      mines: gameRecord.mines,
      layout: gameRecord.layout,
      openRow: gameRecord.openRow,
      openCol: gameRecord.openCol,
      outcome: gameRecord.outcome,
      durationMs: gameRecord.durationMs,
      mineHits: gameRecord.mineHits,
      moves: gameRecord.moves,
      at: gameRecord.createdAt,
    }).from(gameRecord)
      .innerJoin(user, eq(user.id, gameRecord.userId))
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(eq(gameRecord.id, id))
    if (!game) return c.json({ error: "That game doesn't exist" }, 404)
    if (!seesEverything(viewer, game.userId) && game.kind === "daily" && dailyDate(game.at.getTime()) === dailyDate(Date.now())) {
      return c.json({ error: "Replays of today's challenge can be watched once the day is over" }, 403)
    }
    return c.json(game)
  })

  // Singleplayer results used to be reported here by the browser, which could report anything. The server runs
  // those games itself now (over the WebSocket, like multiplayer), so this only tells an old copy of the site so
  .post("/games", (c) => c.json({ error: "This version of the game is out of date. Reload the page." }, 410))

  // Admins only from here on
  .use("/admin/*", async (c, next) => {
    if (!isAdmin(c.get("user"))) return c.json({ error: "Admins only" }, 403)
    await next()
  })

  // Accounts, newest first, optionally only those whose display name, username or email contains `search`
  .get("/admin/users", async (c) => {
    const search = (c.req.query("search") ?? "").trim()
    // % and _ stand for "anything" in a LIKE pattern, so they are escaped to be searched for as themselves
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`
    const matches = search
      ? or(ilike(user.name, pattern), ilike(user.email, pattern), ilike(profile.username, pattern))
      : undefined

    const users = await db.select({
      id: user.id,
      name: user.name,
      username: profile.username,
      email: user.email,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
      emailVerified: user.emailVerified,
      banned: sql<boolean>`coalesce(${user.banned}, false)`,
      banReason: user.banReason,
      elo: profile.elo,
      gamesPlayed: sql<number>`(select count(*) from ${gameResult} where ${gameResult.userId} = ${user.id})`.mapWith(Number),
      // "credential" is an email and password, anything else names the service signed in with
      signInMethods: sql<string[]>`coalesce((select array_agg(${account.providerId} order by ${account.providerId}) from ${account} where ${account.userId} = ${user.id}), '{}')`,
    }).from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(matches)
      .orderBy(desc(user.createdAt))
      .limit(ADMIN_USER_LIMIT)

    const [{ total }] = await db.select({ total: count() }).from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(matches)

    return c.json({ users, total })
  })

  // Puts an account's rating back to where everyone starts
  .post("/admin/users/:userId/reset-rating", async (c) => {
    const changed = await db.update(profile).set({ elo: STARTING_ELO }).where(eq(profile.userId, c.req.param("userId"))).returning({ userId: profile.userId })
    return changed.length ? c.json({ ok: true }) : c.json({ error: "That account has no profile yet" }, 404)
  })

  // Bans an account, or lifts the ban. A banned account is signed out everywhere, cut off from any game it is in,
  // and can't sign back in
  .post("/admin/users/:userId/ban", async (c) => {
    const userId = c.req.param("userId")
    const body = await c.req.json().catch(() => null)
    if (userId === c.get("user").id) return c.json({ error: "You can't ban yourself" }, 400)
    try {
      if (body?.banned === false) {
        await auth.api.unbanUser({ body: { userId }, headers: c.req.raw.headers })
      } else {
        const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : ""
        await auth.api.banUser({ body: { userId, banReason: reason || "Banned by an admin" }, headers: c.req.raw.headers })
        dropPlayer(userId)
      }
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "That couldn't be done" }, 400)
    }
    return c.json({ ok: true })
  })

  // Takes one player's results on one board off the leaderboards, or puts them back: every result of theirs on
  // that board in that kind of game (or, for the daily challenge, their go on that day), since taking away only
  // their best would just show the next best in its place
  .post("/admin/scores/visibility", async (c) => {
    const body = await c.req.json().catch(() => null)
    const { kind, userId, rows, cols, mines, date } = body ?? {}
    const hidden = body?.hidden !== false
    const reason = hidden ? (typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 200) : "Removed by an admin") : null
    if (typeof userId !== "string") return c.json({ error: "Whose results?" }, 400)

    if (kind === "daily") {
      if (typeof date !== "string") return c.json({ error: "Which day?" }, 400)
      await db.update(dailyAttempt).set({ hidden, hiddenReason: reason }).where(and(eq(dailyAttempt.userId, userId), eq(dailyAttempt.date, date)))
    } else if (kind === "singleplayer" || kind === "multiplayer") {
      if (![rows, cols, mines].every(value => isIntBetween(value, 1, 9999))) return c.json({ error: "Which board?" }, 400)
      const table = kind === "singleplayer" ? gameResult : multiplayerResult
      await db.update(table).set({ hidden, hiddenReason: reason })
        .where(and(eq(table.userId, userId), eq(table.rows, rows), eq(table.cols, cols), eq(table.mines, mines)))
    } else {
      return c.json({ error: "Which kind of game?" }, 400)
    }
    return c.json({ ok: true })
  })

  // The latest games that were too fast to have been a person playing, for an admin to look into
  .get("/admin/suspect-games", async (c) => {
    const games = await db.select({
      id: gameRecord.id,
      userId: gameRecord.userId,
      username: sql<string>`coalesce(${profile.username}, ${user.name})`,
      kind: gameRecord.kind,
      rows: gameRecord.rows,
      cols: gameRecord.cols,
      mines: gameRecord.mines,
      durationMs: gameRecord.durationMs,
      clicksNeeded: gameRecord.bv,
      moves: sql<number>`jsonb_array_length(${gameRecord.moves})`.mapWith(Number),
      reason: gameRecord.suspectReason,
      at: gameRecord.createdAt,
    }).from(gameRecord)
      .innerJoin(user, eq(user.id, gameRecord.userId))
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(eq(gameRecord.suspect, true))
      .orderBy(desc(gameRecord.createdAt))
      .limit(50)
    return c.json({ games })
  })
