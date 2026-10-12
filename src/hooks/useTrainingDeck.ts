import { useCallback, useEffect, useRef, useState } from "react"
import { useAccount } from "../context/AccountContext"
import { getTrainingCards, importTrainingCards, sendTrainingReview } from "../lib/api"
import { clearLocalDeck, loadLocalDeck, saveLocalDeck } from "../lib/training"
import type { PatternId } from "../../shared/training/patterns"
import type { Deck } from "../../shared/training/queue"
import { review, type Grade } from "../../shared/training/schedule"

export type TrainingDeck = {
  // the player's cards, or null while they are being fetched
  deck: Deck | null
  // Answers a round of a pattern, and gives the deck as that leaves it: there at once, for picking the next round
  // from, whoever is keeping it
  record: (pattern: PatternId, grade: Grade) => Deck
  // nobody is signed in: the cards are kept in this browser and nowhere else
  local: boolean
  // the cards couldn't be fetched, and why
  error: string | null
  // the last answer didn't reach the server
  unsaved: boolean
  // tries the fetch again
  reload: () => void
}

// The pattern-training cards of whoever is here. A signed-in player's are kept by the server; a visitor's in their
// browser, and taken into their account the moment they have one. Either way the deck here is ahead of what is
// kept: an answer changes it on the spot, by the same schedule the server runs, and the server's word replaces it
// when it comes
export function useTrainingDeck(): TrainingDeck {
  const { session, isPending } = useAccount()
  const userId = session?.user.id ?? null
  const [deck, setDeck] = useState<Deck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unsaved, setUnsaved] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // the deck as it is this instant, for an answer to build on before the page has been drawn again
  const latest = useRef<Deck>({})
  const keep = useCallback((cards: Deck) => {
    latest.current = cards
    setDeck(cards)
  }, [])

  useEffect(() => {
    if (isPending) return
    setError(null)
    setUnsaved(false)
    if (!userId) return keep(loadLocalDeck())

    let cancelled = false
    setDeck(null)
    // whatever was learned here before signing in goes into the account, which keeps what it already had
    const local = loadLocalDeck()
    const fetched = Object.keys(local).length > 0
      ? importTrainingCards(local).then((taken) => {
        clearLocalDeck()
        return taken
      })
      : getTrainingCards()
    fetched.then(
      ({ cards }) => { if (!cancelled) keep(cards) },
      (e: Error) => { if (!cancelled) setError(e.message) },
    )
    return () => { cancelled = true }
  }, [userId, isPending, attempt, keep])

  const record = useCallback((pattern: PatternId, grade: Grade): Deck => {
    const cards = { ...latest.current, [pattern]: review(latest.current[pattern] ?? null, grade, Date.now()) }
    keep(cards)
    if (!userId) {
      saveLocalDeck(cards)
      return cards
    }
    sendTrainingReview(pattern, grade).then(
      ({ card }) => {
        keep({ ...latest.current, [pattern]: card })
        setUnsaved(false)
      },
      () => setUnsaved(true),
    )
    return cards
  }, [userId, keep])

  return { deck, record, local: !userId, error, unsaved, reload: useCallback(() => setAttempt(count => count + 1), []) }
}
