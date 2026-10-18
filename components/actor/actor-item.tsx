import Actor from 'types/actor';
import ActorImgDefault from '../../public/default-actor-img.jpg';
import Image from 'next/image';
import { Link } from 'i18n/routing';
import { tmdbImageUrl } from 'lib/tmdb-image';

/**
 * Cast member card.
 *
 * Clicking a cast member used to open their page on an external site in a new
 * tab. That is a redirect off the app, and it is the thing this component no
 * longer does: the card is now an in-site link to a search for that person's
 * name, so the visitor stays on the site and gets a real, playable result set
 * back.
 *
 * There is no person page to link to — the catalogue's search is title-only
 * and exposes no filmography — so search is the honest in-site destination.
 */
export default function ActorItem({ actor }: { actor: Actor | string }) {
  const name = typeof actor === 'string' ? actor : actor.name;
  const character = typeof actor === 'string' ? undefined : actor.character;
  const imgSrc =
    typeof actor !== 'string' && actor.profile_path
      ? tmdbImageUrl(actor.profile_path, 'profile')
      : ActorImgDefault;
  // The search page reads `?name=`, not `?q=`.
  const href = `/search?name=${encodeURIComponent(name)}`;

  return (
    <Link href={href} title={name} className="group block w-full text-center">
      <div className="relative aspect-square w-full overflow-hidden rounded-full ring-2 ring-transparent transition-all duration-200 group-hover:ring-brand">
        <Image
          src={imgSrc}
          alt={name}
          fill
          className="object-cover object-center transition-transform duration-200 group-hover:scale-105"
          sizes="(max-width: 640px) 45vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
        />
      </div>
      <div className="mt-3 transition-colors group-hover:text-brand">{name}</div>
      {character && <div className="text-sm text-gray-400">{character}</div>}
    </Link>
  );
}
