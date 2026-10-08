import { useState } from "react"
import { useAccount } from "../../context/AccountContext"
import PlayerCard from "./PlayerCard"

type PlayerNameProps = {
  playerId: string
  username: string
  className?: string
}

// A player's name, wherever one is listed. Clicking it opens their profile card, and clicking it again closes it.
// Profiles are for signed-in players, so to anyone else it is only the name
export default function PlayerName({ playerId, username, className = "" }: PlayerNameProps) {
  const { session } = useAccount()
  // the name itself while its card is open: the card pops up beside it
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  if (!session) return <span className={`font-semibold ${className}`}>@{username}</span>
  return (
    <>
      <button
        type="button"
        className={`font-semibold cursor-pointer hover:underline ${className}`}
        title="View profile"
        onClick={(e) => {
          const clicked = e.currentTarget
          setAnchor(open => open ? null : clicked)
        }}
      >
        @{username}
      </button>
      {anchor && <PlayerCard playerId={playerId} anchor={anchor} onClose={() => setAnchor(null)} />}
    </>
  )
}
