/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Fraunces", "Playfair Display", "serif"],
        display: ["Fraunces", "serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          2: "hsl(var(--surface-2))",
          3: "hsl(var(--surface-3))",
        },
        terracotta: {
          DEFAULT: "hsl(var(--terracotta))",
          light: "hsl(var(--terracotta-light))",
          deep: "hsl(var(--terracotta-deep))",
        },
        bone: "hsl(var(--bone))",
        sand: "hsl(var(--sand))",
        ink: "hsl(var(--ink))",
        border: "hsl(var(--border))",
      },
      boxShadow: {
        glow: "0 0 40px hsl(16 65% 60% / 0.35)",
        elegant: "0 20px 50px -20px hsl(0 0% 0% / 0.6)",
        sm: "0 1px 2px hsl(0 0% 0% / 0.4)",
        md: "0 8px 24px -8px hsl(0 0% 0% / 0.5)",
        lg: "0 24px 60px -20px hsl(0 0% 0% / 0.6)",
        navbar: "0 16px 40px -12px rgba(0, 0, 0, 0.8)",
      },
      borderRadius: {
        base: "1rem",
      }
    },
  },
  plugins: [],
}
