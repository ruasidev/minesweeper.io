// A mine: on a cell where one has gone off and been left lying open.
//
// Drawn to go with the flag (FlagIcon): solid shapes with nothing fine in them, so it is still a mine when cells
// are small. A round body with its cap, and the fuse a shade quieter, as the flag's pole is. It takes the colour of
// the text around it, and its size from whoever draws it. (The shapes don't overlap, for the reason the flag's
// don't: a see-through colour drawn twice shows as a brighter patch)
export default function MineIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="10.6" cy="13.9" r="7.4" />
      <rect x="14.75" y="5.45" width="4.3" height="3.1" rx="0.9" transform="rotate(45 16.9 7)" />
      <path d="M18.6 5.3Q20.3 4.6 20.4 2.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}
