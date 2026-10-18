import Actor from 'types/actor';
import ActorImgDefault from '../../public/default-actor-img.jpg';
import Image from 'next/image';
import { Link } from 'i18n/routing';
import { tmdbImageUrl } from 'lib/tmdb-image';

/**
 * Cast member card.
 *
 * Clicking a cast member opens *that person's* page — who they are, their
 * dates and a filmography whose entries link back into this catalogue.
 *
 * The two earlier behaviours are both wrong and both worth naming, because
 * each looked reasonable at the time:
 *
 *  1. It used to open the person's page on an external site in a new tab,
 *     which is a redirect off the app.
 *  2. It then linked to a title search for the person's name, which returns
 *     films *about* them (documentaries, "X: Behind the Scenes") rather than
 *     the person, and which carried none of their details.
 *
 * The name travels in the query string so the person page can render a title
 * and a heading before its own fetch resolves, and so a shared link is
 * self-describing.
 */
export default function ActorItem({ actor }: { actor: Actor | string }) {
  const name = typeof actor === 'string' ? actor : actor.name;
  const character = typeof actor === 'string' ? undefined : actor.character;
  // A cast entry with no TMDB id cannot resolve to a person page; linking
  // anyway would mint a URL that 404s back to the catalogue.
  const personId = typeof actor === 'string' ? undefined : actor.id || undefined;
  const imgSrc =
    typeof actor !== 'string' && actor.profile_path
      ? tmdbImageUrl(actor.profile_path, 'profile')
      : ActorImgDefault;
  const href = personId
    ? `/person/${personId}?name=${encodeURIComponent(name)}`
    : `/search?name=${encodeURIComponent(name)}`;

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
