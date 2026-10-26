import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { THEME_STORAGE_KEY } from "@/components/shell/theme-storage";
import { Providers } from "./providers";
import "@/styles/globals.css";

// Self-hosted (latin subsets from Fontsource, OFL) so dev start-up and builds never wait on Google Fonts.
const sourceSerif = localFont({ src: "./fonts/source-serif-4-latin-600-normal.woff2", weight: "600", variable: "--font-source-serif" });
const plexSans = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-plex-sans",
});
const plexMono = localFont({ src: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", variable: "--font-plex-mono" });

export const metadata: Metadata = { title: "Harrowgate Deal Copilot" };

const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sourceSerif.variable} ${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
