import { useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react"
import { CircleAlert, Eye, EyeOff, Lock, Mail, User } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import type { AuthMode } from "../../game/types"
import { authClient } from "../../lib/authClient"
import { playSound } from "../../lib/sounds"
import { USERNAME_PATTERN } from "../../../shared/profile"
import GoogleIcon from "./GoogleIcon"

const HEADINGS: Record<AuthMode, { title: string, subtitle: string }> = {
  signIn: { title: "Welcome back", subtitle: "Log in to pick up where you left off." },
  signUp: { title: "Create your account", subtitle: "It's free, and takes a few seconds." },
}

type SignInFormProps = {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  onSignedIn: () => void
  // put the cursor in the first box straight away: right for a window that was just opened, not for a form sitting on a page
  autoFocus?: boolean
  // what the form is headed with, where "Welcome back" and "Create your account" don't suit the page it is on
  titles?: Partial<Record<AuthMode, string>>
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  icon: ReactNode
  // something at the right-hand end of the box, like the button that shows the password
  trailing?: ReactNode
}

// One labelled box of the form, with an icon at its left-hand end
function Field({ label, icon, trailing, ...input }: FieldProps) {
  const { theme } = useTheme()
  return (
    <label className="flex flex-col gap-1.5">
      <span className={`text-xs font-semibold cursor-default ${theme.textBody}`}>{label}</span>
      <span className="relative">
        <span className={`absolute inset-y-0 left-3 flex items-center opacity-60 pointer-events-none ${theme.textBody}`}>{icon}</span>
        <input
          {...input}
          className={`w-full pl-10 ${trailing ? "pr-11" : "pr-3"} py-2.5 rounded-lg border select-text outline-none focus:ring-2 placeholder:opacity-50
            ${theme.itemBg} ${theme.itemBorder} ${theme.textBody} ${theme.itemSelectedBorder}`}
        />
        {trailing}
      </span>
    </label>
  )
}

// Logging in and signing up: with Google, or with an email address and a password
export default function SignInForm({ mode, onModeChange, onSignedIn, autoFocus, titles }: SignInFormProps) {
  const { theme } = useTheme()
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // an error from one form doesn't belong on the other
  useEffect(() => setError(null), [mode])

  useEffect(() => {
    if (error) playSound("error")
  }, [error])

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
      // The account's name becomes the starting username on the profile. The link in the email that confirms
      // their address (once the server sends one) brings them back here
      : authClient.signUp.email({ name: username, email, password, callbackURL: window.location.origin }))
    if (signedIn) onSignedIn()
  }

  const iconClass = "w-4 h-4"
  const linkClass = `font-semibold underline underline-offset-2 cursor-pointer hover:opacity-80 ${theme.textHead}`

  return (
    <div className="flex flex-col gap-5">
      <div className="cursor-default">
        <h2 className={`text-2xl font-bold ${theme.textHead}`}>{titles?.[mode] ?? HEADINGS[mode].title}</h2>
        <p className={`mt-1 text-sm opacity-70 ${theme.textBody}`}>{HEADINGS[mode].subtitle}</p>
      </div>

      <button
        className={`w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border pressable font-semibold disabled:opacity-50
          ${theme.itemBg} ${theme.itemHoverBg} ${theme.itemHoverBorder} ${theme.itemBorder} ${theme.textBody}`}
        disabled={busy}
        onClick={() => attempt(() => authClient.signIn.social({ provider: "google", callbackURL: window.location.origin }))}
      >
        <GoogleIcon className="w-5 h-5" />
        Continue with Google
      </button>

      <div className={`flex items-center gap-3 text-xs uppercase tracking-wide cursor-default ${theme.textBody}`}>
        <span className="h-px flex-1 bg-current opacity-20" />
        <span className="opacity-60">or with email</span>
        <span className="h-px flex-1 bg-current opacity-20" />
      </div>

      <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
        {mode === "signUp" && (
          <Field
            label="Username"
            icon={<User className={iconClass} />}
            placeholder="What other players will see"
            autoComplete="username"
            autoFocus={autoFocus}
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
        )}
        <Field
          label="Email"
          icon={<Mail className={iconClass} />}
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus={autoFocus && mode === "signIn"}
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <Field
          label="Password"
          icon={<Lock className={iconClass} />}
          type={showPassword ? "text" : "password"}
          placeholder={mode === "signUp" ? "At least 8 characters" : "Your password"}
          autoComplete={mode === "signUp" ? "new-password" : "current-password"}
          minLength={mode === "signUp" ? 8 : undefined}
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          trailing={
            <button
              type="button"
              className={`absolute inset-y-0 right-1.5 my-auto h-8 w-8 flex items-center justify-center rounded-md cursor-pointer opacity-60 hover:opacity-100 ${theme.textBody}`}
              title={showPassword ? "Hide password" : "Show password"}
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword(shown => !shown)}
            >
              {showPassword ? <EyeOff className={iconClass} /> : <Eye className={iconClass} />}
            </button>
          }
        />

        {error && (
          <p role="alert" className="flex items-start gap-2 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-sm font-semibold text-red-500">
            <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {/* the one button filled in with the theme's highlight, so it is plainly the thing to press */}
        <button
          type="submit"
          className={`mt-1 w-full py-2.5 rounded-lg pressable font-bold disabled:opacity-60 ${theme.itemSelected}`}
          disabled={busy}
        >
          {mode === "signIn" ? "Log in" : "Create account"}
        </button>
      </form>

      <p className={`text-center text-sm cursor-default ${theme.textBody}`}>
        {mode === "signIn" ? "New here? " : "Already have an account? "}
        <button type="button" className={linkClass} onClick={() => onModeChange(mode === "signIn" ? "signUp" : "signIn")}>
          {mode === "signIn" ? "Create an account" : "Log in"}
        </button>
      </p>

      {/* plain pages of their own (public/), opened beside the game rather than in place of it */}
      <p className={`text-center text-xs opacity-60 cursor-default ${theme.textBody}`}>
        By continuing you agree to the{" "}
        <a className="underline" href="/terms.html" target="_blank" rel="noopener">Terms</a> and the{" "}
        <a className="underline" href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.
      </p>
    </div>
  )
}
