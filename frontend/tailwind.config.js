/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        elevated: "var(--elevated)",
        borderc: "var(--border)",
        brand: "var(--brand)",
        mint: "var(--mint)",
        cyan: "var(--cyan)",
        amber: "var(--amber)",
        rose: "var(--rose)",
        tprimary: "var(--text-primary)",
        tsecondary: "var(--text-secondary)",
        tmuted: "var(--text-muted)",
      },
      fontFamily: {
        head: ["'Plus Jakarta Sans'", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
