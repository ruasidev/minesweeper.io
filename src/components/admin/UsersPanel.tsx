import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { getAdminUsers, type AdminUser } from "../../lib/api"
import { avatarSrc } from "../../lib/avatar"
import { isAdminRole } from "../../lib/roles"
import AdminBadge from "./AdminBadge"

// How accounts sign in, as the server names them → as shown in the table
const SIGN_IN_LABELS: Record<string, string> = {
  credential: "Email",
  google: "Google",
}

// Every account, newest first, with a search over display name, username and email
export default function UsersPanel() {
  const { theme } = useTheme()
  const [search, setSearch] = useState("")
  // what was last searched for: `search`, once typing has paused
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<{ users: AdminUser[], total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

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
  }, [query])

  const headClass = `px-4 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${theme.textHead}`
  const cellClass = "px-4 py-2 whitespace-nowrap"

  return (
    <section className={`rounded-xl border shadow-lg shadow-black/40 ring-1 ring-white/10 overflow-hidden ${theme.menuBg} ${theme.menuBorder}`}>
      <div className="flex flex-wrap items-center gap-4 p-4">
        <h2 className={`text-xl font-semibold cursor-default ${theme.textHead}`}>Users</h2>
        {result && (
          <span className={`text-sm opacity-70 cursor-default ${theme.textBody}`}>
            {result.users.length < result.total
              ? `Showing the newest ${result.users.length} of ${result.total}`
              : `${result.total} ${result.total === 1 ? "account" : "accounts"}`}
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
              <th className={headClass}>User</th>
              <th className={headClass}>Username</th>
              <th className={headClass}>Email</th>
              <th className={headClass}>Signs in with</th>
              <th className={`${headClass} text-right`}>Games</th>
              <th className={headClass}>Joined</th>
            </tr>
          </thead>
          <tbody>
            {result?.users.map(account => (
              <tr key={account.id} className={`border-b last:border-b-0 ${theme.itemBorder}`}>
                <td className={cellClass}>
                  <div className="flex items-center gap-3">
                    <img
                      src={avatarSrc(account.image)}
                      alt=""
                      referrerPolicy="no-referrer"
                      className={`w-8 h-8 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`}
                    />
                    <span className="font-semibold">{account.name}</span>
                    {isAdminRole(account.role) && <AdminBadge />}
                  </div>
                </td>
                {/* no username until the account's profile has been opened once */}
                <td className={cellClass}>{account.username ? `@${account.username}` : "–"}</td>
                <td className={cellClass}>{account.email}</td>
                <td className={cellClass}>{account.signInMethods.map(method => SIGN_IN_LABELS[method] ?? method).join(", ") || "–"}</td>
                <td className={`${cellClass} text-right tabular-nums`}>{account.gamesPlayed}</td>
                <td className={cellClass}>{new Date(account.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</td>
              </tr>
            ))}
            {result?.users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 opacity-70 cursor-default">
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
