import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1200px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: "hsl(var(--surface))",
        "white-95": "hsl(var(--white-95))",
        "navy-900": "hsl(var(--navy-900))",
        "navy-800": "hsl(var(--navy-800))",
        "navy-700": "hsl(var(--navy-700))",
        "navy-600": "hsl(var(--navy-600))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        "secondary-accent": {
          DEFAULT: "hsl(var(--secondary-accent))",
          foreground: "hsl(var(--secondary-accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        // 4B System Colors
        "brain-purple": "hsl(var(--brain-purple))",
        "body-blue": "hsl(var(--body-blue))",
        "bat-orange": "hsl(var(--bat-orange))",
        "ball-red": "hsl(var(--ball-red))",
        // Typography tokens
        "text-body": "hsl(var(--text-body))",
        "text-caption": "hsl(var(--text-caption))",
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['DM Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'h1': ['48px', { lineHeight: '1.1', fontWeight: '700' }],
        'h2': ['32px', { lineHeight: '1.2', fontWeight: '700' }],
        'h3': ['22px', { lineHeight: '1.3', fontWeight: '600' }],
        'body': ['16px', { lineHeight: '1.6', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '1.5', fontWeight: '500' }],
      },
      spacing: {
        '18': '4.5rem',    /* 72px */
        '30': '7.5rem',    /* 120px */
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 20px 40px -15px rgba(0, 0, 0, 0.4)',
        'button': '0 4px 16px -4px hsl(3 100% 59% / 0.4)',
        'score': '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        'blue-glow': '0 4px 16px -4px hsl(193 100% 42% / 0.3)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "float-main": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-15px)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "float-delayed": {
          "0%, 100%": { transform: "translateY(-50%)" },
          "50%": { transform: "translateY(calc(-50% - 8px))" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "skeleton-shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float-main": "float-main 6s ease-in-out infinite",
        "float": "float 4s ease-in-out infinite",
        "float-delayed": "float-delayed 4s ease-in-out infinite 1s",
        "float-slow": "float 4s ease-in-out infinite 2s",
        "fade-up": "fade-up 0.4s ease-out both",
        "fade-up-d1": "fade-up 0.4s ease-out 0.05s both",
        "fade-up-d2": "fade-up 0.4s ease-out 0.1s both",
        "fade-up-d3": "fade-up 0.4s ease-out 0.15s both",
        "fade-up-d4": "fade-up 0.4s ease-out 0.2s both",
        "fade-up-d5": "fade-up 0.4s ease-out 0.25s both",
        "skeleton-shimmer": "skeleton-shimmer 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
