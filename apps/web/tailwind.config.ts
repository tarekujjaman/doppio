import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Doppio brand (plan §10)
        primary: {
          DEFAULT: "#0F4C5C",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#C8881A",
          foreground: "#FFFFFF",
        },
      },
    },
  },
  plugins: [],
};

export default config;
