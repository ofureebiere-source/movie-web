import MovieImage from 'types/movie-image';
import Image from 'next/image';
import { tmdbImageUrl } from 'lib/tmdb-image';

interface MovieImageItemProps {
  image: MovieImage;
  onClick?: () => void;
}

export default function MovieImageItem({ image, onClick }: MovieImageItemProps) {
  return (
    <div className="w-full">
      <div
        className="w-full aspect-video rounded-lg overflow-hidden relative cursor-pointer hover:opacity-90 transition-opacity duration-200"
        onClick={onClick}
      >
        <Image
          src={tmdbImageUrl(image.file_path, 'poster')}
          alt="Movie Image"
          fill
          className="object-cover object-center"
          sizes="(max-width: 639px) 83vw, (max-width: 1023px) 50vw, 33vw"
        />
      </div>
    </div>
  );
}
