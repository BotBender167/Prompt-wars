import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-neutral-900 to-neutral-500 bg-clip-text text-transparent dark:from-neutral-50 dark:to-neutral-400">
              Parivar
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link
              href="/discover"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Discover
            </Link>
            <Link
              href="/discover/live"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Live now
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {/* There is no auth yet — this opens the profile editor, so it is
              labelled for what it actually does. */}
          <Button variant="outline" size="sm" asChild>
            <Link href="/parivar">Your profile</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
