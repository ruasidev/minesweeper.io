import type { ThemeProps } from "./themes"

export type AnimationPreviewProps = {
  animation: AnimationChoices
  theme: ThemeProps
}

export type LossAnimationSelectProps = {
  animation: LossAnimationChoices
  theme: ThemeProps
  onChange: (val: LossAnimationChoices) => void
}

export type WinAnimationSelectProps = {
  animation: WinAnimationChoices
  theme: ThemeProps
  onChange: (val: WinAnimationChoices) => void
}

export type LossAnimationChoices =
  | "explode" | "shake"   | "fade"    
  | "pulse"   | "spin"    | "drop"    
  | "flash"   | "crumble" | "burn"
  | "shatter" | "implode" | "fizzle"  
  | "popoff"  | "pig2"    | "none"

export type WinAnimationChoices = 
  | "bloom" | "sparkle" | "celebrate" 
  | "shine" | "pig22"   | "rainbow"

export type AnimationChoices = LossAnimationChoices | WinAnimationChoices

export type AnimationProps<T extends AnimationChoices = AnimationChoices> = {
  id: T                     // Animation ID
  originAnim?: T            // Animation for last clicked cell if different
  label: string             // Animation label for selection
  animDuration: number      // Duration of animation for game result modal delay
}

export const winAnimations: AnimationProps<WinAnimationChoices>[] = [
  { id: "bloom",      originAnim: "bloom",      label: "Bloom",       animDuration: 40 },
  { id: "sparkle",    originAnim: "sparkle",    label: "Sparkle",     animDuration: 40 },
  { id: "celebrate",  originAnim: "celebrate",  label: "Celebrate",   animDuration: 40 },
  { id: "shine",      originAnim: "shine",      label: "Shine",       animDuration: 40 },
  { id: "rainbow",    originAnim: "rainbow",    label: "Rainbow",     animDuration: 40 },
  { id: "pig22",      originAnim: "pig22",      label: "Pig #2 #2",   animDuration: 1000 },
]

export const lossAnimations: AnimationProps<LossAnimationChoices>[] = [
  { id: "explode",    originAnim: "explode",    label: "Explode",     animDuration: 40 },
  { id: "shake",      originAnim: "explode",    label: "Shake",       animDuration: 40 },
  { id: "fade",       originAnim: "explode",    label: "Fade",        animDuration: 40 },
  { id: "pulse",      originAnim: "pulse",      label: "Pulse",       animDuration: 40 },
  { id: "spin",       originAnim: "explode",    label: "Spin",        animDuration: 40 },
  { id: "drop",       originAnim: "explode",    label: "Drop",        animDuration: 40 },
  { id: "flash",      originAnim: "explode",    label: "Flash",       animDuration: 40 },
  { id: "crumble",    originAnim: "popoff",     label: "Crumble",     animDuration: 40 },
  { id: "burn",       originAnim: "explode",    label: "Burn",        animDuration: 40 },
  { id: "shatter",    originAnim: "explode",    label: "Shatter",     animDuration: 40 },
  { id: "implode",    originAnim: "explode",    label: "Implode",     animDuration: 40 },
  { id: "fizzle",     originAnim: "explode",    label: "Fizzle",      animDuration: 40 },
  { id: "pig2",       originAnim: "pig2",       label: "Pig #2",      animDuration: 40 },
  { id: "none",       originAnim: "none",       label: "None",        animDuration: 40 },
]