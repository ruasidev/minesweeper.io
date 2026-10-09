import { env } from "./env.js"

// Sends one email through Resend (https://resend.com). Only possible once RESEND_API_KEY and EMAIL_FROM are set:
// until then the site sends no email at all, and nothing that depends on email is switched on
export async function sendEmail({ to, subject, text }: { to: string, subject: string, text: string }) {
  if (!env.emailEnabled) throw new Error("Email isn't set up on this server")
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom, to, subject, text }),
  })
  if (!response.ok) throw new Error(`Resend refused the email (${response.status}): ${await response.text()}`)
}
