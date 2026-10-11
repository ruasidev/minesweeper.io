// The flag: on a flagged cell, and on whatever is pressed to flag one.
//
// Two solid shapes with nothing fine in them, so it is still a flag when cells are small: a pennant with its
// corners rounded off, and the pole it flies from a shade quieter, so that the pennant is what the eye lands on.
// It takes the colour of the text around it, and its size from whoever draws it.
//
// (The shapes are filled and never outlined, and don't overlap: a theme's text colour can be a little see-through,
// and anything drawn twice in such a colour shows up as a brighter line.)
export default function FlagIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <rect x="5.1" y="2.4" width="2.6" height="19.2" rx="1.3" opacity="0.6" />
      <path d="M8.87 4.27 17.97 8.66Q19.5 9.4 17.97 10.14L8.87 14.53Q7.7 15.1 7.7 13.8V5Q7.7 3.7 8.87 4.27Z" />
    </svg>
  )
}
