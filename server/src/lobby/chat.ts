import { CHAT_HISTORY_MAX, CHAT_TEXT_MAX, type ChatMessage, type Player } from "../../../shared/protocol.js"

// The shortest gap between two chat messages from one player. Not moderation, just a brake on flooding
const CHAT_GAP_MS = 500

let nextChatId = 1

// What has been said lately somewhere: in a room, or in the chat everyone shares
export type ChatLog = {
  // the latest messages, oldest first
  messages: ChatMessage[]
}

export const newChatLog = (): ChatLog => ({ messages: [] })

// what each player needs remembering to hold them to the gap between messages
export type Speaker = { player: Player, lastChatAt: number }

// Adds what a player said to a chat. Returns the message for passing on, or null if it isn't one: empty, too long,
// or too soon after their last
export function say(log: ChatLog, speaker: Speaker, text: string, now: number): ChatMessage | null {
  const trimmed = text.trim()
  if (trimmed.length < 1 || trimmed.length > CHAT_TEXT_MAX || now - speaker.lastChatAt < CHAT_GAP_MS) return null
  speaker.lastChatAt = now

  const message: ChatMessage = { id: nextChatId++, playerId: speaker.player.id, username: speaker.player.username, text: trimmed, sentAt: now }
  log.messages = [...log.messages, message].slice(-CHAT_HISTORY_MAX)
  return message
}
