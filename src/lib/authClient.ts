import { createAuthClient } from "better-auth/react"
import { adminClient } from "better-auth/client/plugins"

// The API server (see server/). Leave VITE_API_URL unset in development: Vite proxies /api to it,
// so the browser sees one origin. Set it when the API is hosted somewhere else than the site
export const API_URL: string = import.meta.env.VITE_API_URL ?? ""

export const authClient = createAuthClient({
  baseURL: API_URL || undefined,
  // adds the account's role to the session
  plugins: [adminClient()],
})
