import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/metadata";

export default function WrittenContentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-dvh bg-background">
      <header className="border-border border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <Link
            className="flex items-center gap-3"
            href={siteConfig.links.home}
          >
            <Image
              src={siteConfig.logo}
              alt={`${siteConfig.name} logo`}
              width={36}
              height={36}
              className="size-9"
            />
            <span className="font-semibold text-lg">{siteConfig.name}</span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Content">
            <Button asChild size="sm" variant="ghost">
              <Link href="/guides">Guides</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/articles">Articles</Link>
            </Button>
          </nav>
        </div>
      </header>
      {children}
    </main>
  );
}
