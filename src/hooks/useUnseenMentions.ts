import { useEffect, useState } from "react"
import { useAccount } from "../context/AccountContext"
import { useConnection } from "../context/ConnectionContext"
import { isMentioned } from "../lib/mentions"

// How many times this player has been mentioned in the global chat since they last looked at it.
// Nothing else said there is counted: it is everybody's chat, somebody is always saying something in it, and a
// count of all that would never be still. What was already there on arriving doesn't count either
export function useUnseenMentions(looking: boolean): number {
  const { session, profile } = useAccount()
  const { globalChat } = useConnection()
  const [seenChatId, setSeenChatId] = useState<number | null>(null)
  const latestChatId = globalChat.at(-1)?.id ?? 0

  useEffect(() => {
    if (looking || (seenChatId === null && latestChatId > 0)) setSeenChatId(latestChatId)
  }, [looking, latestChatId, seenChatId])

  const myName = profile?.username ?? session?.user.name
  return globalChat
    .filter(message => message.id > (seenChatId ?? latestChatId) && message.playerId !== session?.user.id && isMentioned(message.text, myName))
    .length
}
