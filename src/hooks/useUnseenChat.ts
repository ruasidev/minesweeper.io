import { useEffect, useState } from "react"
import { useAccount } from "../context/AccountContext"
import { useConnection } from "../context/ConnectionContext"

// How many messages have arrived in the global chat since it was last looked at.
// What was already there on arriving doesn't count, and neither does anything this player said
export function useUnseenChat(looking: boolean): number {
  const { session } = useAccount()
  const { globalChat } = useConnection()
  const [seenChatId, setSeenChatId] = useState<number | null>(null)
  const latestChatId = globalChat.at(-1)?.id ?? 0

  useEffect(() => {
    if (looking || (seenChatId === null && latestChatId > 0)) setSeenChatId(latestChatId)
  }, [looking, latestChatId, seenChatId])

  return globalChat.filter(message => message.id > (seenChatId ?? latestChatId) && message.playerId !== session?.user.id).length
}
