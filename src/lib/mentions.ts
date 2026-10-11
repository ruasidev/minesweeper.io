// Mentions: a player's name with an @ before it, in something said in a chat. Whoever is named sees the message
// picked out from the rest. Nothing about a mention is the server's business: it is only what was typed, and it is
// the reader's own browser that notices its player's name in it.

// What a name is made of, as shared/profile.ts allows them. An @ only begins a mention at the start of the text or
// after something that couldn't be part of a name, which leaves the @ in the middle of an email address alone
const NAME_CHARACTER = "[A-Za-z0-9_]"
const MENTION = new RegExp(`(^|[^A-Za-z0-9_@])@(${NAME_CHARACTER}{3,20})(?!${NAME_CHARACTER})`, "g")
// ...and one that is still being typed: an @ and whatever of the name there is so far, right at the end
const UNFINISHED = new RegExp(`(?:^|[^A-Za-z0-9_@])@(${NAME_CHARACTER}{0,20})$`)

// A piece of something said: plain text, or a mention of the player named
export type TextPart = { text: string, mention?: string }

// What was said, cut up into its plain text and its mentions, in order
export function partsOf(text: string): TextPart[] {
  const parts: TextPart[] = []
  let done = 0
  for (const found of text.matchAll(MENTION)) {
    // the @ comes after whatever the pattern took in ahead of it
    const at = found.index + found[1].length
    if (at > done) parts.push({ text: text.slice(done, at) })
    parts.push({ text: `@${found[2]}`, mention: found[2] })
    done = at + 1 + found[2].length
  }
  if (done < text.length) parts.push({ text: text.slice(done) })
  return parts
}

// whether something said mentions the player of this name, however they capitalised it
export function isMentioned(text: string, username: string | null | undefined): boolean {
  if (!username) return false
  const wanted = username.toLowerCase()
  return partsOf(text).some(part => part.mention?.toLowerCase() === wanted)
}

// The mention being typed where the caret is, if one is: where its @ is, and the letters after it so far
export function mentionAt(text: string, caret: number): { start: number, query: string } | null {
  const found = UNFINISHED.exec(text.slice(0, caret))
  return found ? { start: caret - found[1].length - 1, query: found[1] } : null
}

// The names that could finish a mention begun with `query`: the ones that start with it, in the order given
// (each once, however it was capitalised)
export function suggestionsFor(query: string, names: string[], limit = 5): string[] {
  const wanted = query.toLowerCase()
  const seen = new Set<string>()
  const matches: string[] = []
  for (const name of names) {
    const key = name.toLowerCase()
    if (seen.has(key) || !key.startsWith(wanted)) continue
    seen.add(key)
    matches.push(name)
    if (matches.length === limit) break
  }
  return matches
}

// The text with the mention being typed at the caret finished as this name, and where the caret goes after it
export function completeMention(text: string, caret: number, username: string): { text: string, caret: number } {
  const typing = mentionAt(text, caret)
  if (!typing) return { text, caret }
  const rest = text.slice(caret)
  // a space after it to carry on typing from, unless there is one already
  const finished = `@${username}${rest.startsWith(" ") ? "" : " "}`
  return { text: text.slice(0, typing.start) + finished + rest, caret: typing.start + finished.length + (rest.startsWith(" ") ? 1 : 0) }
}
