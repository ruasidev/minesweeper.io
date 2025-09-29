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
  | "none"

export type WinAnimationChoices = "bloom"

export type AnimationChoices = LossAnimationChoices | WinAnimationChoices

export type AnimationProps<T extends AnimationChoices = AnimationChoices> = {
  id: T
  originAnim?: T
  label: string
}

export const lossAnimations: AnimationProps<LossAnimationChoices>[] = [
  { id: "explode", originAnim: "explode", label: "Explode" },
  { id: "shake", originAnim: "shake", label: "Shake" },
  { id: "fade", originAnim: "fade", label: "Fade" },
  { id: "pulse", originAnim: "pulse", label: "Pulse" },
  { id: "spin", originAnim: "spin", label: "Spin" },
  { id: "drop", originAnim: "drop", label: "Drop" },
  { id: "flash", originAnim: "flash", label: "Flash" },
  { id: "none", originAnim: "none", label: "None" },
]

export const winAnimations: AnimationProps<WinAnimationChoices>[] = [
  { id: "bloom", originAnim: "bloom", label: "Bloom" },
]

/**
 * Maps animation IDs to Tailwind classes that trigger on hover
 * (used in previews).
 */
export const hoverAnimationClassMap: Record<AnimationChoices, string> = {
  explode: "group-hover:animate-explode",
  shake: "group-hover:animate-shake",
  fade: "group-hover:animate-fade",
  pulse: "group-hover:animate-pulseOut",
  spin: "group-hover:animate-spinOut",
  drop: "group-hover:animate-dropDown",
  flash: "group-hover:animate-flash",
  none: "",
  bloom: "group-hover:animate-bloom",
}

// animations.ts
export const boardAnimClass: Record<LossAnimationChoices, string> = {
  explode: "animate-explode",   // tailwind utility, not .explode
  shake: "animate-shake",
  fade: "animate-fade",
  pulse: "animate-pulseOut",
  spin: "animate-spinOut",
  drop: "animate-dropDown",
  flash: "animate-flash",
  none: "",
}
