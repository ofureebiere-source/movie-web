import { useEffect, useRef } from 'react';
import { Command, Keyboard, X } from 'lucide-react';

/**
 * The keyboard-shortcut legend.
 *
 * Ported 1:1 from frameXTV.xyz's `ShortcutsModal` (the `ye` component in its
 * `WatchPage` chunk): the reference's own shortcut table, a focus trap, Escape
 * to close, and the "Esc to close" footer.
 */
const SHORTCUTS: { keyDesc: string[]; action: string }[] = [
  { keyDesc: ['Space'], action: 'Play / Pause video' },
  { keyDesc: ['F'], action: 'Toggle Fullscreen' },
  { keyDesc: ['M'], action: 'Mute / Unmute audio' },
  { keyDesc: ['←', '→'], action: 'Seek backward / forward 10s' },
  { keyDesc: ['↑', '↓'], action: 'Increase / decrease volume' },
  { keyDesc: ['?'], action: 'Show / hide shortcut guidance' },
  { keyDesc: ['Esc'], action: 'Close dialogs / Exit full views' },
];

export default function ShortcutsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      data-testid="shortcuts-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-md bg-zinc-950 border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 text-left animate-scale-up"
      >
        <div className="flex items-center justify-between border-b border-white/[0.05] pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900/80 border border-white/[0.06] flex items-center justify-center text-zinc-300">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 id="shortcuts-title" className="text-sm sm:text-base font-bold text-white">
                Keyboard Shortcuts
              </h2>
              <p className="text-[11px] text-zinc-400 font-mono">Standard controls for playback</p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            data-testid="shortcuts-close-btn"
            onClick={onClose}
            aria-label="Close keyboard shortcuts dialog"
            className="p-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-white/[0.06] text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 py-1">
          {SHORTCUTS.map((entry) => (
            <div
              key={entry.action}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-zinc-900/50 transition-colors text-xs"
            >
              <span className="text-zinc-300 font-medium">{entry.action}</span>
              <div className="flex items-center gap-1 shrink-0">
                {entry.keyDesc.map((key) => (
                  <kbd
                    key={key}
                    className="min-w-[24px] px-2 py-1 rounded bg-zinc-900/80 border border-white/[0.08] text-zinc-200 font-mono text-[11px] font-semibold text-center shadow-inner"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span>Supported across desktop browsers</span>
          <div className="flex items-center gap-1">
            <Command className="w-3 h-3 text-zinc-600" />
            <span>Esc to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
