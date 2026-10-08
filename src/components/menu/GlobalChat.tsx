import { useAccount } from "../../context/AccountContext"
import { useConnection } from "../../context/ConnectionContext"
import { useTheme } from "../../context/ThemeContext"
import ChatBox from "../multiplayer/ChatBox"

// What the left pane shows for "Global chat": one chat shared by everyone who is online
export default function GlobalChat() {
  const { theme } = useTheme()
  const { session } = useAccount()
  const connection = useConnection()

  if (!session) {
    return <p className={`text-sm opacity-70 cursor-default ${theme.textBody}`}>Log in to see what's being said and join in.</p>
  }
  return (
    <>
      {connection.status !== "connected" && <p className={`text-sm opacity-70 cursor-default ${theme.textBody}`}>Connecting…</p>}
      <ChatBox messages={connection.globalChat} onSend={connection.sendGlobalChat} emptyText="Nobody has said anything yet. Say hello." stacked />
    </>
  )
}
