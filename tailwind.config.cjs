/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pss: {
          pink: "#ff2bb1",
          hot: "#ff007a",
          ink: "#0a0a0c",
          chrome: "#c9c9d1",
          silver: "#e8e8ee",
        },
      },
      fontFamily: {
        display: ["'Anton'", "Impact", "sans-serif"],
        body: ["'Space Grotesk'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        "spin-slow": "spin 18s linear infinite",
        "spin-slower": "spin 40s linear infinite",
        marquee: "marquee 30s linear infinite",
        "marquee-reverse": "marquee-reverse 30s linear infinite",
        shimmer: "shimmer 3.5s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        sparkle: "sparkle 1.6s ease-in-out infinite",
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "marquee-reverse": {
          from: { transform: "translateX(-50%)" },
          to: { transform: "translateX(0)" },
        },
        shimmer: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        sparkle: {
          "0%,100%": { opacity: "0", transform: "scale(0.6) rotate(0deg)" },
          "50%": { opacity: "1", transform: "scale(1) rotate(45deg)" },
        },
      },
    },
  },
  plugins: [],
};
