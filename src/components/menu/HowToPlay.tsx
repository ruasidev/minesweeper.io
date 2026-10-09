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
      {section("Fair play", [
        "When you are signed in, the server runs every game: singleplayer, multiplayer and the daily challenge. It holds the mines and times the game, so results can be trusted.",
        "Each game is recorded move by move. A result that is faster than a person can play is kept off the leaderboards.",
        "Signed out, singleplayer is played in your browser and nothing is kept.",
      ])}
      {section("Multiplayer", [
        "Everyone in the room plays the same board, starting from the same opening.",
        "Uncovering a mine doesn't end your game: it goes off, and covers back up what you had uncovered around it.",
        "The boxes above your board show how far the other players have got.",
        "Once half the players have cleared the board, the rest have a limited time to finish. A bigger board gives more.",
        "You can give up. Once your own game is over you can watch the others play.",
      ])}
      {section("Daily challenge", [
        "One board a day, the same for everyone.",
        "Your clock starts when you start and keeps running until you clear the board.",
      ])}
    </>
  )
}
