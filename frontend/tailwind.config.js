/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Bitter"', '"Merriweather"', 'serif'],
        mono:  ['"IBM Plex Mono"', 'monospace'],
        sans:  ['"Space Grotesk"', '"Manrope"', 'sans-serif'],
      },
      colors: {
        bg:       '#060b18',
        surface:  '#0f172b',
        surface2: '#17233d',
        border:   '#2a3d63',
        accent:   '#2fc7ff',
        success:  '#34d399',
        danger:   '#ff7a85',
        try:      '#f5bf4e',
        text:     '#eaf1ff',
        muted:    '#8da4cf',
      }
    }
  },
  plugins: []
}
