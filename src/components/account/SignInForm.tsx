import { useEffect, useState, type FormEvent } from "react"
import { useTheme } from "../../context/ThemeContext"
import type { AuthMode } from "../../game/types"
import { authClient } from "../../lib/authClient"

// Same rule the server applies to usernames
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/

type SignInFormProps = {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  onSignedIn: () => void
}

export default function SignInForm({ mode, onModeChange, onSignedIn }: SignInFormProps) {
  const { theme } = useTheme()
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // an error from one form doesn't belong on the other
  useEffect(() => setError(null), [mode])

  const inputClass = `w-full px-3 py-2 rounded-md border select-text outline-none focus:ring-2
    ${theme.itemBg} ${theme.itemBorder} ${theme.textBody} ${theme.itemSelectedBorder}`
  const buttonClass = `w-full p-2 rounded-md border pressable font-semibold disabled:opacity-50
    ${theme.itemBg} ${theme.itemHoverBg} ${theme.itemHoverBorder} ${theme.itemBorder} ${theme.textBody}`
  const tabClass = (selected: boolean) => `${buttonClass} text-sm ${selected ? `ring-2 ${theme.itemSelectedBorder}` : "opacity-60"}`

  // Runs a sign-in call and shows whatever goes wrong. Resolves to whether it worked
  async function attempt(call: () => Promise<{ error: { message?: string, code?: string } | null }>): Promise<boolean> {
    setError(null)
    setBusy(true)
    try {
      const { error } = await call()
      if (error) {
        setError(error.code === "PROVIDER_NOT_FOUND"
          ? "Google sign-in isn't set up on the server yet"
          : error.message || "Couldn't reach the server")
      }
      return !error
    } catch {
      setError("Couldn't reach the server")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === "signUp" && !USERNAME_PATTERN.test(username)) {
      setError("Usernames are 3-20 characters: letters, numbers and underscores")
      return
    }
    const signedIn = await attempt(() => mode === "signIn"
      ? authClient.signIn.email({ email, password })
      // The account's name becomes the starting username on the profile
      : authClient.signUp.email({ name: username, email, password }))
    if (signedIn) onSignedIn()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <button className={tabClass(mode === "signIn")} onClick={() => onModeChange("signIn")}>Log in</button>
        <button className={tabClass(mode === "signUp")} onClick={() => onModeChange("signUp")}>Sign up</button>
      </div>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        {mode === "signUp" && (
          <input
            className={inputClass}
            placeholder="Username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
        )}
        <input
          className={inputClass}
          type="email"
          placeholder="Email"
          autoComplete="email"
          autoFocus={mode === "signIn"}
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          className={inputClass}
          type="password"
          placeholder={mode === "signUp" ? "Password (at least 8 characters)" : "Password"}
          autoComplete={mode === "signUp" ? "new-password" : "current-password"}
          minLength={mode === "signUp" ? 8 : undefined}
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <button type="submit" className={buttonClass} disabled={busy}>
          {mode === "signIn" ? "Log in" : "Create account"}
        </button>
      </form>

      <div className={`text-center text-sm opacity-60 cursor-default ${theme.textBody}`}>or</div>

      <button
        className={buttonClass}
        disabled={busy}
        onClick={() => attempt(() => authClient.signIn.social({ provider: "google", callbackURL: window.location.origin }))}
      >
        Continue with Google
      </button>

      {error && <p role="alert" className="text-sm text-red-500 font-semibold">{error}</p>}
    </div>
  )
}
