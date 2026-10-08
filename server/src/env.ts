import "dotenv/config"

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name} (see server/.env.example)`)
  return value
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required("DATABASE_URL"),
  authSecret: required("BETTER_AUTH_SECRET"),
  // The URL the browser uses to reach /api/auth
  authUrl: required("BETTER_AUTH_URL"),
  // Where the frontend is served from
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  // Google sign-in is only switched on when both are set
  googleClientId: process.env.GOOGLE_CLIENT_ID || undefined,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
}
