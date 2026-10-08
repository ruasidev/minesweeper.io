import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { NAV_SPACE } from "../app/MainNavigation"
import AdminBadge from "./AdminBadge"
import UsersPanel from "./UsersPanel"

// The admin part of the site. It takes the game's place beside the left pane.
// What it shows is also checked by the server, so hiding it here is only for tidiness
export default function AdminScreen() {
  const { theme } = useTheme()
  const { isPending, isAdmin } = useAccount()

  return (
    <div className={`h-full overflow-y-auto hide-scrollbar ${theme.background}`} style={{ paddingLeft: NAV_SPACE }}>
      <div className="flex flex-col gap-4 py-4 pl-2 pr-4">
        <div className="flex items-center gap-3">
          <h1 className={`text-2xl font-semibold cursor-default ${theme.textHead}`}>Admin</h1>
          {isAdmin && <AdminBadge />}
        </div>

        {isPending ? null : isAdmin ? (
          <UsersPanel />
        ) : (
          <p className={`cursor-default ${theme.textBody}`}>This part of the site is for admin accounts only.</p>
        )}
      </div>
    </div>
  )
}
