import { Alexandria, IBM_Plex_Sans_Arabic } from "next/font/google";

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

// Headings: the same display face as the owner's sibling products (NAQAH, Seet); body stays in Plex.
const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-alexandria",
  display: "swap",
});

export function TammeniExperience({ children }: { children: React.ReactNode }) {
  return <div className={`tammeni-experience ${plex.variable} ${alexandria.variable}`}>{children}</div>;
}
