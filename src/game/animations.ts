export type AnimationPreviewProps = {
  animation: AnimationChoices
}

export type LossAnimationSelectProps = {
  animation: LossAnimationChoices
  onChange: (val: LossAnimationChoices) => void
}

export type WinAnimationSelectProps = {
  animation: WinAnimationChoices
  onChange: (val: WinAnimationChoices) => void
}

export type LossAnimationChoices =
  | "explode"
  | "shake"
  | "fade"
  | "pulse"
  | "spin"
  | "drop"
  | "flash"
  | "crumble"
  | "burn"
  | "shatter"
  | "implode"
  | "fizzle"
  | "none"


export type WinAnimationChoices = "bloom" | "sparkle" | "celebrate" | "shine" | "rainbow"

export type AnimationChoices = LossAnimationChoices | WinAnimationChoices

export type AnimationProps<T extends AnimationChoices = AnimationChoices> = {
  id: T
  originAnim?: T
  label: string
}

export const winAnimations: AnimationProps<WinAnimationChoices>[] = [
  { id: "bloom", originAnim: "bloom", label: "Bloom" },
  { id: "sparkle", originAnim: "sparkle", label: "Sparkle" },
  { id: "celebrate", originAnim: "celebrate", label: "Celebrate" },
  { id: "shine", originAnim: "shine", label: "Shine" },
  { id: "rainbow", originAnim: "rainbow", label: "Rainbow" },
]

export const lossAnimations: AnimationProps<LossAnimationChoices>[] = [
  { id: "explode", originAnim: "explode", label: "Explode" },
  { id: "shake", originAnim: "shake", label: "Shake" },
  { id: "fade", originAnim: "fade", label: "Fade" },
  { id: "pulse", originAnim: "pulse", label: "Pulse" },
  { id: "spin", originAnim: "spin", label: "Spin" },
  { id: "drop", originAnim: "drop", label: "Drop" },
  { id: "flash", originAnim: "flash", label: "Flash" },
  { id: "crumble", originAnim: "crumble", label: "Crumble" },
  { id: "burn", originAnim: "burn", label: "Burn" },
  { id: "shatter", originAnim: "shatter", label: "Shatter" },
  { id: "implode", originAnim: "implode", label: "Implode" },
  { id: "fizzle", originAnim: "fizzle", label: "Fizzle" },
  { id: "none", originAnim: "none", label: "None" },
]



/**
 * Maps animation IDs to Tailwind classes that trigger on hover
 * (used in previews).
 */
// export const hoverAnimationClassMap: Record<AnimationChoices, string> = {
//   explode: "group-hover:animate-explode",
//   shake: "group-hover:animate-shake",
//   fade: "group-hover:animate-fade",
//   pulse: "group-hover:animate-pulseOut",
//   spin: "group-hover:animate-spinOut",
//   drop: "group-hover:animate-dropDown",
//   flash: "group-hover:animate-flash",
//   none: "",
//   bloom: "group-hover:animate-bloom",
//   sparkle: "group-hover:animate-sparkle",
//   celebrate: "group-hover:animate-celebrate",
//   shine: "group-hover:animate-shine",
//   rainbow: "group-hover:animate-rainbow",
// }

export const boardAnimClass: Record<LossAnimationChoices, string> = {
  explode: "animate-explode",
  shake: "animate-shake",
  fade: "animate-fade",
  pulse: "animate-pulseOut",
  spin: "animate-spinOut",
  drop: "animate-dropDown",
  flash: "animate-flash",
  crumble: "animate-crumble",
  burn: "animate-burn",
  shatter: "animate-shatter",
  implode: "animate-implode",
  fizzle: "animate-fizzle",
  none: "",
}

export const boardWinAnimClass: Record<WinAnimationChoices, string> = {
  bloom: "animate-bloom",
  sparkle: "animate-sparkle",
  celebrate: "animate-celebrate",
  shine: "animate-shine",
  rainbow: "animate-rainbow",
}