"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "GAME" },
  { href: "/prompt", label: "PROMPT" },
  { href: "/leaderboard", label: "LEADERBOARD" },
  { href: "/apps", label: "APPS" },
];

const isActive = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="tabs">
      {TABS.map(tab => (
        <Link key={tab.href} href={tab.href} className={isActive(tab.href, pathname) ? "active" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
