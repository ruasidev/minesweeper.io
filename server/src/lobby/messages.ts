import { isRoomMode, isSoloMode } from "../../../shared/game/modes.js"
import type { BoardSettings, CellPosition, ClientMessage } from "../../../shared/protocol.js"

// Reading what a browser sent. Anything can arrive on a socket, so nothing is taken on trust: a message is either
// one of the shapes below, with every part of it the type it should be, or it is thrown away.
// What a message asks for is judged later, by whatever handles it (is there such a room, is that cell on the
// board, is it this player's turn to say so). Here it is only made safe to handle.

type Fields = Record<string, unknown>

const isText = (value: unknown): value is string => typeof value === "string"
const isNumber = (value: unknown): value is number => typeof value === "number"
const isObject = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value)
const isOptional = <T>(value: unknown, is: (value: unknown) => value is T): value is T | undefined => value === undefined || is(value)

const isPosition = (value: unknown): value is CellPosition => isObject(value) && isNumber(value.row) && isNumber(value.col)

// For each kind of message, what it takes to be one. A message with nothing but its type takes nothing
const readers: { [Type in ClientMessage["type"]]: (fields: Fields) => Extract<ClientMessage, { type: Type }> | null } = {
  createRoom: ({ name, visibility, passcode }) =>
    isText(name) && (visibility === "public" || visibility === "private") && isOptional(passcode, isText)
      ? { type: "createRoom", name, visibility, passcode } : null,
  joinRoom: ({ roomId, passcode }) => (isText(roomId) && isOptional(passcode, isText) ? { type: "joinRoom", roomId, passcode } : null),
  leaveRoom: () => ({ type: "leaveRoom" }),
  chat: ({ text }) => (isText(text) ? { type: "chat", text } : null),
  globalChat: ({ text }) => (isText(text) ? { type: "globalChat", text } : null),
  makeHost: ({ playerId }) => (isText(playerId) ? { type: "makeHost", playerId } : null),
  kick: ({ playerId }) => (isText(playerId) ? { type: "kick", playerId } : null),
  setMode: ({ mode }) => (isRoomMode(mode) ? { type: "setMode", mode } : null),
  // whether the settings are a board that can be made is for whoever handles them to say (and to tell the player)
  setSettings: ({ settings }) => (isObject(settings) ? { type: "setSettings", settings: settings as BoardSettings } : null),
  startGame: () => ({ type: "startGame" }),
  endGame: () => ({ type: "endGame" }),
  giveUp: () => ({ type: "giveUp" }),
  spectate: ({ playerId }) => (playerId === null || isText(playerId) ? { type: "spectate", playerId } : null),
  startSolo: ({ mode, settings, opening }) =>
    isSoloMode(mode) && isOptional(settings, isObject) && isOptional(opening, isPosition)
      ? { type: "startSolo", mode, settings: settings as BoardSettings | undefined, opening: opening && { row: opening.row, col: opening.col } } : null,
  endSolo: () => ({ type: "endSolo" }),
  reveal: ({ row, col }) => (isNumber(row) && isNumber(col) ? { type: "reveal", row, col } : null),
  flag: ({ row, col }) => (isNumber(row) && isNumber(col) ? { type: "flag", row, col } : null),
}

// The message in what a browser sent, or null if there isn't one in it
export function parseMessage(raw: string): ClientMessage | null {
  let fields: unknown
  try {
    fields = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObject(fields) || !isText(fields.type) || !Object.hasOwn(readers, fields.type)) return null
  return readers[fields.type as ClientMessage["type"]](fields)
}
