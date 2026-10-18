import { SITE_NAME } from 'constants/brand';

export default function BrandingPlaceholder() {
  return (
    <div className="w-full h-full flex justify-center items-center opacity-10 font-extrabold text-4xl sm:text-6xl lg:text-9xl py-20">
      <span>{SITE_NAME}</span>
    </div>
  );
}
