import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import Page from "../app/Page"
import AdminBadge from "./AdminBadge"
import SuspectGamesPanel from "./SuspectGamesPanel"
import UsersPanel from "./UsersPanel"

// The admin part of the site. It takes the game's place beside the left pane.
// What it shows is also checked by the server, so hiding it here is only for tidiness
export default function AdminScreen() {
  const { theme } = useTheme()
  const { isPending, isAdmin } = useAccount()

  return (
    <Page title="Admin" aside={isAdmin && <AdminBadge />} maxWidth="max-w-none">
        {isPending ? null : isAdmin ? (
          <>
            <UsersPanel />
            <SuspectGamesPanel />
          </>
        ) : (
          <p className={`cursor-default ${theme.textBody}`}>This part of the site is for admin accounts only.</p>
        )}
    </Page>
  )
}
