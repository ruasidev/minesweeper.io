interface MiniClockProps {
  time: number // seconds elapsed
}

export function MiniClock({ time }: MiniClockProps) {
  const seconds = time % 60
  const rotation = seconds * 6 // 6° per second

  return (
    <div className="relative w-6 h-6 rounded-full border-2 border-current flex items-center justify-center">
      {/* second hand */}
      <div
        className="absolute w-[2px] h-full flex items-start justify-center origin-center"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: seconds === 0 ? "none" : "transform 0.3s ease",
        }}
      >
        <div className="w-[2px] h-3 bg-current rounded-full" />
      </div>
    </div>
  )
}
