/**
 * The brand marks the chrome needs.
 *
 * These are the reference's own inline SVGs, copied path-for-path: the X bird,
 * the Discord mascot and the pump.fun diamond. `lucide-react` has no
 * equivalent for any of them, and its generic "Twitter" bird is a different
 * mark, so they are vendored here rather than approximated.
 */

export function XIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} role="img" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function DiscordIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor" role="img" aria-hidden="true">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a74.77,74.77,0,0,0,64.3,0c.87.69,1.76,1.37,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1,105.25,105.25,0,0,0,32.19-16.14c2.64-27.38-4.51-51.11-18.88-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.89,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.89,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  );
}

export function PumpIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 397 311" fill="currentColor" className={className} role="img" aria-hidden="true">
      <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7zM64.6 3.8C67 1.4 70.3 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8zm267.8 115.3c-2.4-2.4-5.7-3.8-9.2-3.8H5.8c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" />
    </svg>
  );
}

export function BitcoinIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} role="img" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm4.845 13.567c-.203 1.36-.98 1.956-2.28 2.06v2.102h-1.258V15.65c-.328.016-.66.026-.995.031v2.046H11.05v-2.018c-.287.003-.574.004-.858 0h-1.74v-1.39s.938.025.92-.02c.513 0 .753-.326.837-.624l.004-.017v-4.49c-.046-.145-.195-.453-.76-.453.018-.045-.92-.02-.92-.02V7.32h1.74c.27-.003.542 0 .815.006V5.278h1.262v2.09c.334.008.665.021.995.038v-2.08h1.258v2.128c1.332.148 2.228.783 2.378 2.188.12 1.132-.345 1.83-1.196 2.186 1.052.33 1.517 1.094 1.308 2.437zm-2.05-3.693c0-1.124-.913-1.373-1.92-1.428v2.856c1.008-.055 1.92-.304 1.92-1.428zm.292 3.65c0-1.22-.992-1.478-2.212-1.538v3.076c1.22-.06 2.212-.317 2.212-1.538z" />
    </svg>
  );
}
