import { ShieldCheck } from "lucide-react"

// Marks an account as an admin wherever it is shown. The same colours on every theme, so it always stands out.
// `iconOnly` is for beside a name where there is no room to spare for the word: the shield alone, on its patch
export default function AdminBadge({ iconOnly }: { iconOnly?: boolean }) {
  if (iconOnly) {
    return (
      <span title="Admin account" aria-label="Admin account" role="img" className="inline-flex shrink-0 items-center justify-center w-5 h-5 rounded-md bg-amber-400 text-black cursor-default">
        <ShieldCheck className="w-3.5 h-3.5" />
      </span>
    )
  }
  return (
    <span
      title="Admin account"
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400 text-black text-[10px] font-bold uppercase tracking-wide leading-none cursor-default"
    >
      <ShieldCheck className="w-3 h-3" />
      Admin
    </span>
  )
}
