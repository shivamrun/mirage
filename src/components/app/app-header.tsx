import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/shared/metadata";
import { AppHeaderAuthActions } from "./app-header-auth-actions";
import { AppThemeToggle } from "./app-theme-toggle";

function AppHeader({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <header className="border-border border-b">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <Link className="flex items-center gap-3" href={siteConfig.links.home}>
          <Image
            src={siteConfig.logo}
            alt={`${siteConfig.name} logo`}
            width={36}
            height={36}
            className="size-9"
            priority
          />
          <span className="font-semibold text-lg">{siteConfig.name}</span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Primary">
          <Button asChild className="hidden md:inline-flex" variant="ghost">
            <Link href="/guides">Guides</Link>
          </Button>
          <Button asChild className="hidden md:inline-flex" variant="ghost">
            <Link href="/articles">Articles</Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex" variant="ghost">
            <Link href="/contact">Contact</Link>
          </Button>
          <AppThemeToggle />
          <AppHeaderAuthActions isAuthenticated={isAuthenticated} />
        </nav>
      </div>
    </header>
  );
}

export { AppHeader };
