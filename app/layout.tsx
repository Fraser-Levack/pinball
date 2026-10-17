import type { Metadata } from "next";
import Nav from "@/components/Nav";
import { PlayerProvider } from "@/components/PlayerProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prompt Pinball",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PlayerProvider>
          <Nav />
          {children}
        </PlayerProvider>
      </body>
    </html>
  );
}
