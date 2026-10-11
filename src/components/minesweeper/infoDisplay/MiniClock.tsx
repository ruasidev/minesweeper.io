// A little clock face whose one hand goes round once a minute
export default function MiniClock({ seconds }: { seconds: number }) {
  const second = seconds % 60

  return (
    <div className="relative w-4 h-4 rounded-full border-2 border-current flex items-center justify-center">
      <div
        className="absolute w-[2px] h-full flex items-start justify-center origin-center"
        // six degrees a second; back to the top without sweeping all the way round
        style={{ transform: `rotate(${second * 6}deg)`, transition: second === 0 ? "none" : "transform 0.3s ease" }}
      >
        <div className="w-[2px] h-2 bg-current rounded-full" />
      </div>
    </div>
  )
}
