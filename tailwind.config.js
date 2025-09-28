/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      keyframes: {
        explode: {
          "0%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.5) rotate(20deg)", opacity: "0.7" },
          "100%": { transform: "scale(0.2) rotate(-45deg)", opacity: "0" },
        },
      },
      animation: {
        explode: "explode 600ms ease-out forwards",
      },
    },
  },
}
