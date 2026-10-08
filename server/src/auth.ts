import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin } from "better-auth/plugins"
import { db } from "./db/index.js"
import * as schema from "./db/schema.js"
import { env } from "./env.js"

export const auth = betterAuth({
  baseURL: env.authUrl,
  secret: env.authSecret,
  trustedOrigins: [env.clientOrigin],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: env.googleClientId && env.googleClientSecret
    ? { google: { clientId: env.googleClientId, clientSecret: env.googleClientSecret } }
    : {},
  // Gives every account a role ("user" unless made "admin", see scripts/set-role.ts) and the means to ban accounts
  plugins: [admin()],
})
