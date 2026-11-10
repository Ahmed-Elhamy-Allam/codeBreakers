import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Cyber / terminal neon palette
        cyber: {
          bg: '#05070d',
          panel: '#0b1120',
          panelLight: '#111a2e',
          border: '#1e3a5f',
        },
        neon: {
          green: '#39ff14',
          cyan: '#00f0ff',
          magenta: '#ff00e5',
          yellow: '#faff00',
          red: '#ff2d55',
          blue: '#2d7bff',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
        display: ['"Orbitron"', '"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'neon-green': '0 0 5px #39ff14, 0 0 20px rgba(57,255,20,0.6)',
        'neon-cyan': '0 0 5px #00f0ff, 0 0 20px rgba(0,240,255,0.6)',
        'neon-magenta': '0 0 5px #ff00e5, 0 0 20px rgba(255,0,229,0.6)',
        'neon-red': '0 0 5px #ff2d55, 0 0 20px rgba(255,45,85,0.6)',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-6px)' },
          '80%': { transform: 'translateX(6px)' },
        },
        lockIn: {
          '0%': { transform: 'scale(1)', boxShadow: '0 0 0 rgba(57,255,20,0)' },
          '50%': { transform: 'scale(1.18)', boxShadow: '0 0 25px rgba(57,255,20,0.9)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 12px rgba(57,255,20,0.6)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        flicker: {
          '0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%': { opacity: '1' },
          '20%, 24%, 55%': { opacity: '0.4' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        shake: 'shake 0.4s ease-in-out',
        lockIn: 'lockIn 0.5s ease-out',
        pulseGlow: 'pulseGlow 1.5s ease-in-out infinite',
        flicker: 'flicker 2s linear infinite',
        scan: 'scan 3s linear infinite',
        float: 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
