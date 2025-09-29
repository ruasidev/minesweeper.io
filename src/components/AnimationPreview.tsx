import type { AnimationPreviewProps } from "../game/animations"
// import { hoverAnimationClassMap } from "../game/animations"

export function AnimationPreview({ animation }: AnimationPreviewProps) {
  const cells = Array.from({ length: 9 })

  return (
    <div className="grid grid-cols-3 gap-1 w-20 h-20 group">
      {cells.map((_, i) => (
        <span
          key={i}
          className={`
            w-5 h-5 border border-black rounded-sm flex items-center justify-center
            bg-gray-500
            hover:animate-flash
          `}
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  )
}
