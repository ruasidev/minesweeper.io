import type { ReactNode } from "react"
import { useTheme } from "../../context/ThemeContext"
import SidebarSectionHeader from "./SidebarSectionHeader"

// What the left pane shows for "How to play"
export default function HowToPlay() {
  const { theme } = useTheme()

  const section = (title: string, lines: ReactNode[]) => (
    <div>
      <SidebarSectionHeader text={title} />
      <ul className={`flex flex-col gap-2 list-disc pl-5 text-sm cursor-default ${theme.textBody}`}>
        {lines.map((line, index) => <li key={index}>{line}</li>)}
      </ul>
    </div>
  )

  return (
    <>
      {section("The basics", [
        "Click a cell to uncover it. A number says how many mines touch that cell.",
        "Uncover every cell that isn't a mine to win.",
        "Your first click is always safe, and so are the cells around it.",
      ])}
      {section("Flags", [
        "Right-click a covered cell to flag it as a mine. Right-click again to take the flag off.",
        "A flagged cell can't be uncovered by accident.",
      ])}
      {section("Chording", [
        "Once a number has that many flags around it, click the number to uncover the rest of its neighbours at once.",
        "If a flag is in the wrong place, chording uncovers a mine.",
        "If the flags don't add up yet, the cells it is waiting on flash.",
      ])}
      {section("Multiplayer", [
        "Everyone in the room plays the same board, starting from the same opening.",
        "Uncovering a mine doesn't end your game: you sit out for three seconds.",
        "The boxes above your board show how far the other players have got.",
      ])}
      {section("Daily challenge", [
        "One board a day, the same for everyone.",
        "Your clock starts when you start and keeps running until you clear the board.",
      ])}
    </>
  )
}
