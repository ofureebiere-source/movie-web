import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'custome-red': '#e10711',
        brand: {
          DEFAULT: '#e10711',
          hover: '#ff1a25',
          muted: 'rgba(225, 7, 17, 0.15)',
        },
        surface: {
          /* Fixed dark scrim for artwork — never flips with the scheme. */
          overlay: 'var(--surface-overlay)',
          /* Translucent pane fill; flips (light ink on dark, dark ink on light). */
          chip: 'var(--surface-chip)',
          chipHover: 'var(--surface-chip-hover)',
          /* The three-step surface ramp, by role. Both schemes are defined in
             globals.css and chosen by `prefers-color-scheme`. */
          primary: 'rgb(var(--bg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--bg-secondary) / <alpha-value>)',
          card: 'rgb(var(--bg-card) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--border-color) / <alpha-value>)',
          hover: 'rgb(var(--border-hover) / <alpha-value>)',
        },
        content: {
          main: 'rgb(var(--text-main) / <alpha-value>)',
          soft: 'rgb(var(--text-soft) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
        },
        /* Fixed white ramp for text that sits on artwork or video, where the
           background is a photograph in both schemes. Do NOT use on a page
           surface — use `content-main` / `content-muted` there instead. */
        ink: {
          primary: 'var(--ink-primary)',
          secondary: 'var(--ink-secondary)',
          disabled: 'var(--ink-disabled)',
        },
      },
      fontFamily: {
        /* Upstream's stacks, so any `font-sans` / `font-mono` class resolves to
           the same face the upstream site renders. */
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      maxWidth: {
        shell: '80rem',
      },
      boxShadow: {
        custom: 'rgba(0, 0, 0, 0.35) 0px 5px 15px',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [
    // `touch:` applies on devices that can't hover (phones/tablets), `can-hover:`
    // on hover-capable pointers. Used to reveal hover-only card actions on touch.
    plugin(({ addVariant }) => {
      addVariant('touch', '@media (hover: none)');
      addVariant('can-hover', '@media (hover: hover)');
    }),
  ],
};
export default config;
