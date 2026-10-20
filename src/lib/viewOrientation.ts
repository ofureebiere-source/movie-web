/**
 * View orientation for the two surfaces that play a landscape-friendly video
 * into whatever box the layout gives them: the hero trailer and the movie
 * player.
 *
 * Both take a `view` prop whose default suits the content — the trailer is a
 * short-form YouTube embed, so it starts portrait; the movie is feature-length
 * and starts landscape — and both offer a toggle that flips between the two.
 * The toggle is deliberately not persisted: a preference is a property of the
 * surface, not of the viewer, so the defaults above must survive a reload.
 *
 * Portrait is capped by height, landscape by width, so the ratio is enforced by
 * the box itself (`aspect-[9/16]`) and centred within the surrounding slot. That
 * keeps the morph, which measures the slot rather than the video, pointed at the
 * same rect either way.
 */
export type PlayerView = 'landscape' | 'portrait';

export const VIEW_ASPECT_CLASS: Record<PlayerView, string> = {
  landscape: 'aspect-video',
  portrait: 'aspect-[9/16]',
};

/** Flip to the other orientation. */
export function nextView(view: PlayerView): PlayerView {
  return view === 'portrait' ? 'landscape' : 'portrait';
}
