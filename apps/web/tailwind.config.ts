import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  safelist: [
    {
      pattern:
        /(bg|text|border|from|to|shadow)-(slate|gray|purple|pink|orange|amber|yellow|blue|cyan|emerald|green|rose|red)-(400|500|600)(\/(5|10|20|30|40|60|80))?/,
    },
  ],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      // Container query breakpoints (mobile-optimized)
      containers: {
        xs: '20rem',
        sm: '24rem',
        md: '28rem',
        lg: '32rem',
        xl: '36rem',
        '2xl': '42rem',
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'slide-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' }
        },
        'step-activate': {
          '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 hsl(var(--primary) / 0.5)' },
          '30%': { transform: 'scale(1.2)', boxShadow: '0 0 0 12px hsl(var(--primary) / 0)' },
          '70%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 hsl(var(--primary) / 0)' }
        },
        'step-enter': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px hsl(160 84% 39% / 0.3), 0 0 0 0 hsl(160 84% 39% / 0.2)' },
          '50%': { boxShadow: '0 0 12px hsl(160 84% 39% / 0.5), 0 0 0 6px hsl(160 84% 39% / 0.1)' }
        },
        'fade-slide-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'fade-slide-out': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-6px)' }
        },
        'celebration-bounce': {
          '0%': { opacity: '0', transform: 'scale(0.8) translateY(20px)' },
          '50%': { transform: 'scale(1.05) translateY(-4px)' },
          '70%': { transform: 'scale(0.98) translateY(2px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' }
        },
        'spin-once': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        },
        'scale-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' }
        },
        'shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' }
        },
        'bounce-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        'glow': {
          '0%, 100%': { boxShadow: '0 0 20px hsl(var(--primary) / 0.3)' },
          '50%': { boxShadow: '0 0 30px hsl(var(--primary) / 0.5)' }
        },
        'card-tilt': {
          '0%': { transform: 'perspective(1000px) rotateY(0deg) rotateX(0deg)' },
          '100%': { transform: 'perspective(1000px) rotateY(5deg) rotateX(-2deg)' }
        },
        'swipe-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% center' },
          '50%': { backgroundPosition: '100% center' }
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        'persona-speaking': {
          '0%, 100%': { transform: 'scale(1)' },
          '25%': { transform: 'scale(1.05) rotate(-2deg)' },
          '75%': { transform: 'scale(1.02) rotate(1deg)' }
        },
        'persona-thinking': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '25%': { transform: 'translateY(-2px) scale(1.02)' },
          '75%': { transform: 'translateY(1px) scale(0.98)' }
        },
        'persona-wave': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '10%': { transform: 'rotate(14deg)' },
          '20%': { transform: 'rotate(-8deg)' },
          '30%': { transform: 'rotate(14deg)' },
          '40%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(10deg)' },
          '60%, 100%': { transform: 'rotate(0deg)' }
        },
        'speech-bar': {
          '0%, 100%': { transform: 'scaleY(0.4)', opacity: '0.6' },
          '50%': { transform: 'scaleY(1)', opacity: '1' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.6s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'step-activate': 'step-activate 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'step-enter': 'step-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'fade-slide-in': 'fade-slide-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'fade-slide-out': 'fade-slide-out 0.3s ease-in forwards',
        'celebration-bounce': 'celebration-bounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'spin-once': 'spin-once 0.5s cubic-bezier(0.4, 0, 0.2, 1) both',
        'scale-pulse': 'scale-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s infinite',
        'bounce-in-up': 'bounce-in-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out',
        'card-tilt': 'card-tilt 0.6s ease-out forwards',
        'swipe-in-left': 'swipe-in-left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'gradient-shift': 'gradient-shift 3s ease infinite',
        'count-up': 'count-up 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'persona-speaking': 'persona-speaking 0.6s ease-in-out infinite',
        'persona-thinking': 'persona-thinking 1.2s ease-in-out infinite',
        'persona-wave': 'persona-wave 2s ease-in-out',
        'speech-bar': 'speech-bar 0.8s ease-in-out infinite'
      },
      backgroundImage: {
        'fashion-gradient': 'var(--gradient-fashion)',
        'subtle-gradient': 'var(--gradient-subtle)'
      }
    }
  },
} satisfies Config
