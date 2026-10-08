import { useAccount } from "../../context/AccountContext";
import { useTheme } from "../../context/ThemeContext";
import type { AuthMode } from "../../game/types";
import { avatarSrc } from "../../lib/avatar";
import AdminBadge from "../admin/AdminBadge";

// The account corner of the header: "Log in" / "Sign up" when signed out, otherwise who is signed in.
// All of them open the account window
export default function AccountButtons({ onOpenAuth, onOpenProfile }: { onOpenAuth: (mode: AuthMode) => void, onOpenProfile: () => void }) {
    const { theme } = useTheme()
    const { session, isPending, isAdmin, profile } = useAccount()

    // Not known yet whether someone is signed in; show neither rather than flash the wrong one
    if (isPending) return null

    if (!session) {
        return (
            <>
                <button
                    onClick={() => onOpenAuth("signIn")}
                    className={`h-10 px-3 rounded font-semibold transition-colors hover:opacity-80 pressable ${theme.textHead} ${theme.itemHoverBg}`}
                >
                    Log in
                </button>
                <button
                    onClick={() => onOpenAuth("signUp")}
                    className={`h-10 px-3 rounded border font-semibold transition-colors hover:opacity-80 pressable
                        ${theme.itemBg} ${theme.itemBorder} ${theme.itemHoverBg} ${theme.textBody}`}
                >
                    Sign up
                </button>
            </>
        )
    }

    return (
        <button
            onClick={onOpenProfile}
            className={`h-10 flex items-center gap-2 pl-3 pr-2 rounded transition-colors hover:opacity-80 pressable ${theme.textHead} ${theme.itemHoverBg}`}
            title="Account"
        >
            {isAdmin && <AdminBadge />}
            <span className="font-semibold max-w-40 truncate">{profile?.username ?? session.user.name}</span>
            <img
                src={avatarSrc(session.user.image)}
                alt=""
                referrerPolicy="no-referrer"
                className={`w-8 h-8 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`}
            />
        </button>
    )
}
