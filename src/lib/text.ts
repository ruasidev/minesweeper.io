// 1, "mine" → "1 mine"; 3, "mine" → "3 mines". For the words that take an s
export const plural = (count: number, word: string): string => `${count} ${count === 1 ? word : `${word}s`}`
