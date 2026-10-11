import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { navigate } from "../../hooks/useRoute"
import { getAdminUsers, resetRating, setBanned, type AdminUser } from "../../lib/api"
import { avatarSrc } from "../../lib/avatar"
import { isAdminRole } from "../../lib/roles"
import AdminBadge from "./AdminBadge"
import { plural } from "../../lib/text"
import { useFormStyles } from "../../hooks/useFormStyles"

// How accounts sign in, as the server names them → as shown in the table
const SIGN_IN_LABELS: Record<string, string> = {
  credential: "Email",
  google: "Google",
}

// Every account, newest first, with a search over display name, username and email
export default function UsersPanel() {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const [search, setSearch] = useState("")
  // what was last searched for: `search`, once typing has paused
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<{ users: AdminUser[], total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // bumped to load the list again after something about an account was changed
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    getAdminUsers(query)
      .then(loaded => { if (!cancelled) { setResult(loaded); setError(null) } })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [query, reload])

  // Does something to an account once the admin has said yes to it, then shows the list as it now stands
  function act(question: string, action: () => Promise<unknown>) {
    if (!window.confirm(question)) return
    action().then(() => { setError(null); setReload(n => n + 1) }, (e: Error) => setError(e.message))
  }
  function ban(account: AdminUser) {
    const reason = window.prompt(`Ban ${account.name} (${account.email})? They are signed out everywhere and can't sign back in.\n\nReason (they are shown it):`, "")
    if (reason === null) return
    setBanned(account.id, true, reason).then(() => { setError(null); setReload(n => n + 1) }, (e: Error) => setError(e.message))
  }
  // bare until the pointer is over them: one box per button, in every row, would be a lot of boxes
  const actionClass = `${styles.ghostSmall} select-none`

  return (
    <section className={`rounded-xl border shadow-lg shadow-black/40 ring-1 ring-white/10 overflow-hidden ${theme.menuBg} ${theme.menuBorder}`}>
      <div className="flex flex-wrap items-center gap-4 p-4">
        <h2 className={`text-xl font-semibold cursor-default ${theme.textHead}`}>Users</h2>
        {result && (
          <span className={`text-sm opacity-70 cursor-default ${theme.textBody}`}>
            {result.users.length < result.total
              ? `Showing the newest ${result.users.length} of ${result.total}`
              : `${plural(result.total, "account")}`}
          </span>
        )}
        <label className={`ml-auto flex items-center gap-2 px-3 py-2 w-72 max-w-full rounded-md border focus-within:ring-2
          ${theme.itemBg} ${theme.itemBorder} ${theme.textBody} ${theme.itemSelectedBorder}`}
        >
          <Search className="w-4 h-4 shrink-0 opacity-70" />
          <input
            className="flex-1 min-w-0 bg-transparent outline-none select-text"
            placeholder="Search name, username or email"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
      </div>

      {error && <p role="alert" className="px-4 pb-4 text-sm text-red-500 font-semibold">{error}</p>}

      <div className="overflow-x-auto">
        <table className={`w-full text-sm text-left select-text ${theme.textBody}`}>
          <thead>
            <tr className={`border-y ${theme.itemBorder} ${theme.itemBg}`}>
              <th className={styles.th}>User</th>
              <th className={styles.th}>Username</th>
              <th className={styles.th}>Email</th>
              <th className={styles.th}>Signs in with</th>
              <th className={`${styles.th} text-right`}>Games</th>
              <th className={`${styles.th} text-right`}>Rating</th>
              <th className={styles.th}>Joined</th>
              {/* the buttons stay at the right-hand edge however far the table has to scroll sideways */}
              <th className={`${styles.th} sticky right-0 ${theme.itemBg}`} />
            </tr>
          </thead>
          <tbody>
            {result?.users.map(account => (
              <tr key={account.id} className={`border-b last:border-b-0 ${theme.itemBorder}`}>
                <td className={styles.td}>
                  <div className="flex items-center gap-3">
                    <img
                      src={avatarSrc(account.image)}
                      alt=""
                      referrerPolicy="no-referrer"
                      className={`w-8 h-8 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`}
                    />
                    <span className="font-semibold">{account.name}</span>
                    {isAdminRole(account.role) && <AdminBadge />}
                    {account.banned && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-500 text-[10px] font-bold uppercase tracking-wide" title={account.banReason ?? undefined}>Banned</span>
                    )}
                  </div>
                </td>
                {/* no username until the account's profile has been opened once */}
                <td className={styles.td}>{account.username ? `@${account.username}` : "–"}</td>
                <td className={styles.td}>
                  {account.email}
                  {!account.emailVerified && <span className="ml-2 text-xs opacity-60" title="This address hasn't been confirmed">unconfirmed</span>}
                </td>
                <td className={styles.td}>{account.signInMethods.map(method => SIGN_IN_LABELS[method] ?? method).join(", ") || "–"}</td>
                <td className={`${styles.td} text-right tabular-nums`}>{account.gamesPlayed}</td>
                <td className={`${styles.td} text-right tabular-nums`}>{account.elo ?? "–"}</td>
                <td className={styles.td}>{new Date(account.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</td>
                <td className={`${styles.td} sticky right-0 ${theme.menuBg}`}>
                  <div className="flex justify-end gap-2">
                    <button className={actionClass} onClick={() => navigate("history", account.id)}>Games</button>
                    {account.elo !== null && (
                      <button className={actionClass} onClick={() => act(`Put ${account.name}'s rating back to where everyone starts?`, () => resetRating(account.id))}>
                        Reset rating
                      </button>
                    )}
                    {account.banned
                      ? <button className={actionClass} onClick={() => act(`Lift the ban on ${account.name}?`, () => setBanned(account.id, false))}>Unban</button>
                      : !isAdminRole(account.role) && <button className={`${actionClass} text-red-500`} onClick={() => ban(account)}>Ban</button>}
                  </div>
                </td>
              </tr>
            ))}
            {result?.users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 opacity-70 cursor-default">
                  {query ? `No accounts match "${query}"` : "No accounts yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
