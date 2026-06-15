import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        // Doppio logo system — "you" (plum) + "the echo" (coral) + "the spark".
        // Plum scale anchored at 800 (#3B2C56); 950 is the system "ink".
        primary: {
          50: "#f4f2f8",
          100: "#e8e4f0",
          200: "#d2c9e2",
          300: "#b3a4cd",
          400: "#8e78ae",
          500: "#6e5790",
          600: "#564275",
          700: "#463860",
          800: "#3b2c56",
          900: "#2e2444",
          950: "#271d3d",
          DEFAULT: "#3b2c56",
          foreground: "#ffffff",
        },
        // Coral scale anchored at 500 (#F0664A); 300 is the system "spark".
        accent: {
          50: "#fef4f1",
          100: "#fde5df",
          200: "#fbcabe",
          300: "#f4a47e",
          400: "#f4845f",
          500: "#f0664a",
          600: "#dc4e33",
          700: "#b83d27",
          800: "#973526",
          900: "#7c3025",
          950: "#43140e",
          DEFAULT: "#f0664a",
          foreground: "#ffffff",
        },
        // Standalone brand tokens from the logo system.
        spark: "#f4a47e", // overlap lens — "the spark of memory"
        paper: "#f3eee9", // warm light for reversed marks
        ink: "#271d3d", // primary text
        muted: "#6e667d", // secondary text
        // Warm the neutral scale toward plum so it sits with the brand.
        slate: {
          50: "#f7f5f8",
          100: "#efedf1",
          200: "#e2dee6",
          300: "#ccc6d1",
          400: "#9c95a3",
          500: "#6e667d",
          600: "#544d60",
          700: "#3f3849",
          800: "#2c2536",
          900: "#271d3d",
          950: "#1a1329",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(59 44 86 / 0.04), 0 1px 6px -1px rgb(59 44 86 / 0.06), 0 2px 12px -2px rgb(59 44 86 / 0.06)",
        "card-hover":
          "0 2px 4px 0 rgb(59 44 86 / 0.06), 0 4px 12px -2px rgb(59 44 86 / 0.10), 0 8px 24px -4px rgb(59 44 86 / 0.10)",
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
