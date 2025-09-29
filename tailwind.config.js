/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        explode: {
          "0%": { transform: "scale(1)", opacity: "1" },
          "10%": {
            transform: "scale(0.5) rotate(100deg)",
            opacity: "1",
            backgroundColor: "#ff0000",
            borderRadius: "10px",
          },
          "20%": {
            transform: "scale(0.5) rotate(100deg)",
            backgroundColor: "#fff157",
            borderRadius: "20px",
          },
          "50%": {
            transform: "scale(3) rotate(150deg)",
            opacity: "0.7",
            backgroundColor: "#ff6a00",
            borderRadius: "30px",
          },
          "100%": {
            transform: "scale(3) rotate(170deg)",
            opacity: "0.3",
            backgroundColor: "#360000",
            borderRadius: "40px",
          },
        },
        shake: {
          "0%": { transform: "translateX(0)", backgroundColor: "#ffffff" },
          "20%, 60%": { transform: "translateX(-6px)", backgroundColor: "#fb7341" },
          "40%, 80%": { transform: "translateX(6px)", backgroundColor: "#ff1e00" },
          "100%": { backgroundColor: "#ff0000" },
        },
        fade: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        spinOut: {
          "0%": { transform: "rotate(0deg) scale(1)", opacity: "1" },
          "50%": { transform: "rotate(180deg) scale(1.2)", opacity: "0.8" },
          "100%": { transform: "rotate(720deg) scale(0.2)", opacity: "0" },
        },
        pulseOut: {
          "0%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.3)", opacity: "0.7" },
          "100%": { transform: "scale(0.5)", opacity: "0" },
        },
        dropDown: {
          "0%": {
            transform: "translateY(0) scale(1)",
            opacity: "1",
            backgroundColor: "#ffffff",
          },
          "10%": { backgroundColor: "#ff8c2e" },
          "50%": { backgroundColor: "#ff462e", opacity: "0.9" },
          "100%": {
            transform: "translateY(-200%) scale(0.5)",
            opacity: "0",
            backgroundColor: "#6c0000",
          },
        },
        flash: {
          "0%,100%": { backgroundColor: "#ff0000", opacity: "1" },
          "50%": { backgroundColor: "#ffffff", opacity: "0.9" },
        },
      },
      animation: {
        explode: "explode 600ms ease-out forwards",
        shake: "shake 0.6s ease-in-out forwards",
        fade: "fade 800ms ease-out forwards",
        spinOut: "spinOut 1000ms ease-out forwards",
        pulseOut: "pulseOut 700ms ease-out forwards",
        dropDown: "dropDown 800ms cubic-bezier(0.25,0.46,0.45,0.94) forwards",
        flash: "flash 400ms ease-in-out forwards",
      },
    },
  },
  safelist: [
    "animate-explode",
    "animate-shake",
    "animate-fade",
    "animate-pulseOut",
    "animate-spinOut",
    "animate-dropDown",
    "animate-flash",
    "animate-bloom",
  ],
}
