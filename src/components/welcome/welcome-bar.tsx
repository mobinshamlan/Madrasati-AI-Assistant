import { BrandBlock } from "@/components/brand/brand-block";

/** The welcome page's top row. */
export function WelcomeBar() {
  return (
    <header className="on-board border-b border-board-raised">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <BrandBlock href="/welcome" label="طمّنـــي — الصفحة التعريفية" />
      </div>
    </header>
  );
}
