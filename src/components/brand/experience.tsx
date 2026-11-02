import { IBM_Plex_Sans_Arabic } from "next/font/google";

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export function TammeniExperience({ children }: { children: React.ReactNode }) {
  return <div className={`tammeni-experience ${plex.variable}`}>{children}</div>;
}
