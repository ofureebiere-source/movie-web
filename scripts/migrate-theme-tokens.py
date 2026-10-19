#!/usr/bin/env python3
"""One-shot migration of hardcoded dark colours to the scheme-aware tokens.

Only page-chrome surfaces are touched. Anything that sits on artwork or video
(components/watch/**, components/movie-images/**) is skipped: those stay dark in
both schemes by design and are handled separately.
"""
import re
import sys

# Ordered longest-prefix-first so `bg-white/10` is not caught by a `bg-white` rule.
MAP = [
    # --- solid page surfaces -------------------------------------------------
    ("bg-black/95", "bg-surface-primary/95"),
    ("bg-black/90", "bg-surface-primary/90"),
    ("bg-black/80", "bg-surface-primary/80"),
    ("bg-black", "bg-surface-primary"),
    ("bg-neutral-900", "bg-surface-secondary"),
    ("bg-neutral-800/60", "bg-surface-secondary/60"),
    ("bg-neutral-800/40", "bg-surface-secondary/40"),
    ("bg-neutral-700/60", "bg-surface-chip"),
    ("bg-neutral-700", "bg-surface-chip"),
    ("bg-zinc-950/80", "bg-surface-primary/80"),
    ("bg-zinc-900/80", "bg-surface-secondary/80"),
    ("bg-zinc-900", "bg-surface-secondary"),
    ("bg-gray-900/50", "bg-surface-secondary/50"),
    ("bg-gray-800/60", "bg-surface-chip"),
    ("bg-gray-800/50", "bg-surface-chip"),
    ("bg-gray-800/30", "bg-surface-chip"),
    ("bg-gray-800", "bg-surface-secondary"),
    ("bg-gray-700/50", "bg-surface-chip"),
    # --- translucent panes ---------------------------------------------------
    ("bg-white/20", "bg-surface-chip-hover"),
    ("bg-white/15", "bg-surface-chip"),
    ("bg-white/10", "bg-surface-chip"),
    ("bg-white/5", "bg-surface-chip"),
    ("bg-white/[0.05]", "bg-surface-chip"),
    ("bg-white/[0.03]", "bg-surface-chip"),
    ("bg-white/40", "bg-surface-chip-hover"),
    # --- borders -------------------------------------------------------------
    ("border-white/[0.15]", "border-line"),
    ("border-white/[0.08]", "border-line"),
    ("border-white/[0.06]", "border-line"),
    ("border-white/[0.05]", "border-line"),
    ("border-white/60", "border-line"),
    ("border-white/40", "border-line"),
    ("border-white/30", "border-line"),
    ("border-white/20", "border-line"),
    ("border-white/15", "border-line"),
    ("border-white/10", "border-line"),
    ("border-white", "border-line"),
    ("border-gray-800", "border-line"),
    ("border-gray-700", "border-line"),
    ("border-gray-600", "border-line"),
    ("border-gray-500", "border-line"),
    ("ring-white/20", "ring-line"),
    ("ring-white/15", "ring-line"),
    ("ring-white/10", "ring-line"),
    ("divide-white/5", "divide-line"),
    # --- text ----------------------------------------------------------------
    ("text-white/90", "text-content-main/90"),
    ("text-white/85", "text-content-main/85"),
    ("text-white/80", "text-content-main/80"),
    ("text-white/75", "text-content-main/75"),
    ("text-white/70", "text-content-main/70"),
    ("text-white/60", "text-content-muted"),
    ("text-white/55", "text-content-muted"),
    ("text-white/50", "text-content-muted"),
    ("text-white/40", "text-content-muted/70"),
    ("text-white", "text-content-main"),
    ("text-gray-100", "text-content-main"),
    ("text-gray-200", "text-content-soft"),
    ("text-gray-300", "text-content-soft"),
    ("text-gray-400", "text-content-muted"),
    ("text-gray-500", "text-content-muted"),
    ("text-gray-600", "text-content-muted/70"),
    ("text-zinc-200", "text-content-main"),
    ("text-zinc-300", "text-content-soft"),
    ("text-zinc-400", "text-content-muted"),
    ("text-zinc-500", "text-content-muted/70"),
    ("text-[#bbb6ae]", "text-content-muted"),
    # --- fills (spinners) ----------------------------------------------------
    ("fill-white", "fill-content-main"),
    ("fill-gray-600", "fill-content-muted"),
    ("fill-gray-300", "fill-content-soft"),
]

# `text-surface` is a dangling class: the config's `surface` key has no DEFAULT,
# so it resolves to nothing. Point it at the real token.
FIXUPS = [("text-surface", "text-content-main")]

SKIP_DIRS = ("components/watch/", "components/movie-images/")
ROOT = "."


def migrate(text: str) -> tuple[str, int]:
    n = 0
    for src, dst in FIXUPS + MAP:
        # Word-boundary on both ends, and never inside a longer utility such as
        # `hover:bg-white/10` -> that still matches, which is what we want.
        pattern = re.compile(r"(?<![\w-])" + re.escape(src) + r"(?![\w-])")
        text, k = pattern.subn(dst, text)
        n += k
    return text, n


def main(paths):
    total = 0
    for path in paths:
        if any(path.startswith(d) for d in SKIP_DIRS):
            continue
        with open(path, encoding="utf-8") as f:
            original = f.read()
        updated, n = migrate(original)
        if updated != original:
            with open(path, "w", encoding="utf-8") as f:
                f.write(updated)
            total += n
            print(f"{n:4d}  {path}")
    print(f"total replacements: {total}")


if __name__ == "__main__":
    main(sys.argv[1:])
