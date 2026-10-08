import { ShieldCheck } from "lucide-react"

// Marks an account as an admin wherever it is shown. The same colours on every theme, so it always stands out
export default function AdminBadge() {
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
