export type ThemeSelectProps = {
    themeId: ThemeChoices,
    onChange: (id: ThemeChoices) => void
}

export type ThemeChoices = 
    | "classic"
    | "ocean"
    | "forest"
    | "retro"
    | "solarized"
    | "pastel"
    | "neon"
    | "desert"
    | "pig"

export type ThemeProps = {
    id: ThemeChoices
    name: string
    author: string | null
    background: string
    menuBg: string
    menuBorder: string
    cellHidden: string
    cellVisible: string
    cellFlagged: string
    cellBorder: string
    textHead: string
    textBody: string
    cellHoverBorder: string
    cellHoverBg: string
}

export const themes: ThemeProps[] = [
  {
    id: "classic",
    name: "Classic",
    author: "ruasi",
    background: "bg-neutral-900",
    menuBg: "bg-gray-800",
    menuBorder: "border-gray-700",
    cellHidden: "bg-gray-500",
    cellVisible: "bg-gray-600",
    cellFlagged: "bg-red-500",
    cellBorder: "border-gray-900",
    textHead: "text-black",
    textBody: "text-black",
    cellHoverBorder: "hover:border-red-400",
    cellHoverBg: "hover:bg-gray-600",
  },
  {
    id: "ocean",
    name: "Ocean",
    author: "ChatGPT",
    background: "bg-slate-950",
    menuBg: "bg-slate-800",
    menuBorder: "border-slate-700",
    cellHidden: "bg-blue-900",
    cellVisible: "bg-blue-500",
    cellFlagged: "bg-rose-500",
    cellBorder: "border-gray-900",
    textHead: "text-black",
    textBody: "text-black",
    cellHoverBorder: "hover:border-rose-400",
    cellHoverBg: "hover:bg-blue-700",
  },
  {
    id: "forest",
    name: "Forest",
    author: "ChatGPT",
    background: "bg-green-950",
    menuBg: "bg-emerald-900",
    menuBorder: "border-emerald-800",
    cellHidden: "bg-green-700",
    cellVisible: "bg-green-500",
    cellFlagged: "bg-amber-600",
    cellBorder: "border-gray-900",
    textHead: "text-black",
    textBody: "text-black",
    cellHoverBorder: "hover:border-amber-500",
    cellHoverBg: "hover:bg-green-800",
  },
  {
    id: "retro",
    name: "Retro",
    author: "ChatGPT",
    background: "bg-violet-950",
    menuBg: "bg-purple-950",
    menuBorder: "border-purple-900",
    cellHidden: "bg-amber-400",
    cellVisible: "bg-yellow-400",
    cellFlagged: "bg-rose-600",
    cellBorder: "border-gray-900",
    textHead: "text-black",
    textBody: "text-black",
    cellHoverBorder: "hover:border-rose-400",
    cellHoverBg: "hover:bg-amber-500",
  },
  {
    id: "solarized",
    name: "Solarized",
    author: "ChatGPT",
    background: "bg-cyan-950",
    menuBg: "bg-teal-950",
    menuBorder: "border-slate-600",
    cellHidden: "bg-sky-600",
    cellVisible: "bg-teal-500",
    cellFlagged: "bg-red-600",
    cellBorder: "border-gray-900",
    textHead: "text-black",
    textBody: "text-black",
    cellHoverBorder: "hover:border-red-400",
    cellHoverBg: "hover:bg-sky-700",
  },
  {
    id: "pastel",
    name: "Pastel",
    author: "ChatGPT",
    background: "bg-orange-50",
    menuBg: "bg-rose-50",
    menuBorder: "border-rose-200",
    cellHidden: "bg-blue-200",
    cellVisible: "bg-sky-200",
    cellFlagged: "bg-rose-300",
    cellBorder: "border-gray-200",
    textHead: "text-black",
    textBody: "text-black",
    cellHoverBorder: "hover:border-rose-400",
    cellHoverBg: "hover:bg-blue-300",
  },
  {
    id: "neon",
    name: "Neon",
    author: "ChatGPT",
    background: "bg-neutral-950",
    menuBg: "bg-gray-900",
    menuBorder: "border-gray-800",
    cellHidden: "bg-cyan-400",
    cellVisible: "bg-violet-400",
    cellFlagged: "bg-rose-400",
    cellBorder: "border-gray-900",
    textHead: "text-white",
    textBody: "text-white",
    cellHoverBorder: "hover:border-violet-400",
    cellHoverBg: "hover:bg-cyan-500",
  },
  {
    id: "desert",
    name: "Desert",
    author: "ChatGPT",
    background: "bg-amber-100",
    menuBg: "bg-amber-200",
    menuBorder: "border-amber-400",
    cellHidden: "bg-amber-800",
    cellVisible: "bg-amber-100",
    cellFlagged: "bg-orange-700",
    cellBorder: "border-gray-900",
    textHead: "text-black",
    textBody: "text-black",
    cellHoverBorder: "hover:border-orange-500",
    cellHoverBg: "hover:bg-amber-300",
  },
  {
    id: "pig",
    name: "Pig",
    author: "FawnPonyo",
    background: "bg-pink-200",
    menuBg: "bg-cyan-200",
    menuBorder: "border-lime-100",
    cellHidden: "bg-red-500",
    cellVisible: "bg-rose-100",
    cellFlagged: "bg-violet-400",
    cellBorder: "border-gray-900",
    textHead: "text-black",
    textBody: "text-black",
    cellHoverBorder: "hover:border-violet-400",
    cellHoverBg: "hover:bg-pink-300",
  },
]
