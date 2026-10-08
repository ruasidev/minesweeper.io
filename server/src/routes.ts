import { count, desc, eq, ilike, or, sql } from "drizzle-orm"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { createMiddleware } from "hono/factory"
import { auth } from "./auth.js"
import { db } from "./db/index.js"
import { account, avatar, gameResult, profile, user } from "./db/schema.js"
import { getJoinDate, getOrCreateProfile, getStats, isUsernameTaken, USERNAME_PATTERN } from "./profile.js"

type SessionUser = typeof auth.$Infer.Session.user

// The browser shrinks photos to 256x256 before sending them, so real uploads are far below this
const AVATAR_MAX_BYTES = 512 * 1024

// The image formats accepted as profile photos, by the bytes every file of that format starts with
const AVATAR_TYPES: Record<string, (data: Buffer) => boolean> = {
  "image/jpeg": (data) => data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  "image/png": (data) => data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (data) => data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP",
}

// Open to everyone: profile photos are shown to other players
export const publicRoutes = new Hono()
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
  const { username } = await getOrCreateProfile(account)
  return {
    username,
    joinedAt: (await getJoinDate(account.id)).toISOString(),
    stats: await getStats(account.id),
  }
}

// The admin screen shows at most this many accounts at once; searching narrows it down
const ADMIN_USER_LIMIT = 100

// A role is a comma-separated list, so an account can hold more than one
const isAdmin = (account: SessionUser) => account.role?.split(",").includes("admin") ?? false

// Postgres error code for breaking a unique index; drizzle wraps the driver's error in `cause`
function isUniqueViolation(error: unknown): boolean {
  const code = (e: unknown) => (e as { code?: string } | null)?.code
  return code(error) === "23505" || code((error as { cause?: unknown } | null)?.cause) === "23505"
}

const isIntBetween = (value: unknown, low: number, high: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= low && value <= high

export const routes = new Hono<{ Variables: { user: SessionUser } }>()
  .use(requireUser)

  // The signed-in player's own profile
  .get("/profile", async (c) => c.json(await profileResponse(c.get("user"))))

  .patch("/profile", async (c) => {
    const account = c.get("user")
    const body = await c.req.json().catch(() => null)
    const username = typeof body?.username === "string" ? body.username.trim() : ""
    if (!USERNAME_PATTERN.test(username)) {
      return c.json({ error: "Usernames are 3-20 characters: letters, numbers and underscores" }, 400)
    }

    await getOrCreateProfile(account)
    if (await isUsernameTaken(username, account.id)) return c.json({ error: "That username is taken" }, 409)
    try {
      await db.update(profile).set({ username }).where(eq(profile.userId, account.id))
    } catch (error) {
      // someone else took it between the check and the update
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

  // Record a finished game. The result is whatever the browser reports: fine for personal stats,
  // but anything competitive will need the server to run the game itself
  .post("/games", async (c) => {
    const body = await c.req.json().catch(() => null)
    const { rows, cols, mines, won, durationSeconds } = body ?? {}
    const valid =
      isIntBetween(rows, 4, 99) &&
      isIntBetween(cols, 4, 99) &&
      isIntBetween(mines, 1, rows * cols - 9) &&
      typeof won === "boolean" &&
      isIntBetween(durationSeconds, 0, 24 * 60 * 60)
    if (!valid) return c.json({ error: "Invalid game result" }, 400)

    await db.insert(gameResult).values({ userId: c.get("user").id, rows, cols, mines, won, durationSeconds })
    return c.json({ ok: true }, 201)
  })

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
