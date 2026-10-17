"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "GAME" },
  { href: "/prompt", label: "PROMPT" },
  { href: "/leaderboard", label: "LEADERBOARD" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="tabs">
      {TABS.map(tab => (
        <Link key={tab.href} href={tab.href} className={pathname === tab.href ? "active" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
