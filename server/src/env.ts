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
  // Sending email (through Resend) is only switched on when both are set: an API key, and the address the
  // emails come from, which has to be on a domain Resend has been shown to be yours
  resendApiKey: process.env.RESEND_API_KEY || undefined,
  emailFrom: process.env.EMAIL_FROM || undefined,
  get emailEnabled(): boolean {
    return Boolean(this.resendApiKey && this.emailFrom)
  },
}
