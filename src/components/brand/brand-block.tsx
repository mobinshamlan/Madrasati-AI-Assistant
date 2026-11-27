import Image from "next/image";
import Link from "next/link";

/**
 * The top row's identity, the same on every page: the logo, and beside it the name with the prototype notice
 * under it. The notice stays on one line, so its size follows the screen width on small phones.
 */
export function BrandBlock({ href, label }: { href: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-3 sm:gap-3">
      <Link href={href} aria-label={label} className="relative size-12 shrink-0 rounded-lg sm:size-14">
        <span aria-hidden="true" className="absolute inset-x-[13%] bottom-0 aspect-square rounded-full bg-chalk" />
        <Image src="/brand/tammeni-logo.png" alt="" width={168} height={168} loading="eager" className="relative h-full w-full object-contain" />
      </Link>
      <div className="min-w-0">
        <p translate="no" className="font-display text-[1.125rem] leading-7 font-semibold text-chalk sm:text-[1.375rem]">
          طمّنـــي
        </p>
        <p role="note" className="whitespace-nowrap text-[clamp(0.5625rem,3vw,0.75rem)] leading-5 text-chalk-soft sm:text-[0.875rem]">
          نسخة تجريبية ببيانات وهمية، غير تابعة لمنصة مدرستي الرسمية
        </p>
      </div>
    </div>
  );
}
