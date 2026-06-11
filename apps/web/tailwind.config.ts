import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        // Deep-teal brand scale built around #0F4C5C
        primary: {
          50: "#eff8fa",
          100: "#d8edf2",
          200: "#b5dce6",
          300: "#84c3d4",
          400: "#4ba2bb",
          500: "#2f86a1",
          600: "#1f6d88",
          700: "#16586f",
          800: "#0f4c5c",
          900: "#0d3d4b",
          950: "#062832",
          DEFAULT: "#0f4c5c",
          foreground: "#ffffff",
        },
        // Amber accent scale built around #C8881A
        accent: {
          50: "#fdf9ed",
          100: "#f8eecd",
          200: "#f1dc97",
          300: "#e9c661",
          400: "#e3b13c",
          500: "#d99a24",
          600: "#c8881a",
          700: "#a06618",
          800: "#835119",
          900: "#6c4318",
          950: "#3e2309",
          DEFAULT: "#c8881a",
          foreground: "#ffffff",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 76 92 / 0.04), 0 1px 6px -1px rgb(15 76 92 / 0.06), 0 2px 12px -2px rgb(15 76 92 / 0.06)",
        "card-hover":
          "0 2px 4px 0 rgb(15 76 92 / 0.06), 0 4px 12px -2px rgb(15 76 92 / 0.10), 0 8px 24px -4px rgb(15 76 92 / 0.10)",
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "fade-up": "fade-up 0.5s ease-out both",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
