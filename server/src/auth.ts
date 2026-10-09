import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin } from "better-auth/plugins"
import { db } from "./db/index.js"
import * as schema from "./db/schema.js"
import { sendEmail } from "./email.js"
import { env } from "./env.js"

export const auth = betterAuth({
  baseURL: env.authUrl,
  secret: env.authSecret,
  trustedOrigins: [env.clientOrigin],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
  },
  // Once the server can send email, an account made with an email address is sent a link to confirm it.
  // Nobody is kept out for not having confirmed, but their games don't count towards ratings until they have:
  // it is what makes a second account cost something. (An account made through Google is confirmed from the start.)
  ...(env.emailEnabled ? {
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }: { user: { email: string, name: string }, url: string }) => {
        await sendEmail({
          to: user.email,
          subject: "Confirm your email for Minesweeper World",
          text: `Hi ${user.name},\n\nConfirm this email address for your Minesweeper World account by opening this link:\n\n${url}\n\nIf you didn't make an account, you can ignore this email.`,
        })
      },
    },
  } : {}),
  socialProviders: env.googleClientId && env.googleClientSecret
    ? { google: { clientId: env.googleClientId, clientSecret: env.googleClientSecret } }
    : {},
  // Gives every account a role ("user" unless made "admin", see scripts/set-role.ts) and the means to ban accounts
  plugins: [admin()],
})
