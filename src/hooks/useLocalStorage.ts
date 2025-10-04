import { useEffect, useState } from "react"

export function useLocalStorage<T>(key: string, initialValue: T) {
    const [value, setValue] = useState<T>(() => {
        const saved = localStorage.getItem(key);
        return saved !== null ? JSON.parse(saved) as T : initialValue
    })

    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(value))
    }, [key, value])

    return [value, setValue] as const;
}