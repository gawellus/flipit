import { useState, useEffect, useCallback } from "react";
import { LayoutDashboard, Sparkles, RectangleEllipsis, Layers, Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  user: { email: string } | null;
  pathname: string;
  variant?: "default" | "marketing";
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/flashcards", label: "Flashcards", icon: RectangleEllipsis },
  { href: "/study", label: "Study", icon: Layers },
] as const;

function getInitial(email: string): string {
  return email.charAt(0).toUpperCase();
}

export default function Topbar({ user, pathname, variant = "default" }: TopbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobile();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen, closeMobile]);

  const isMarketing = variant === "marketing";
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 flex h-16 items-center px-6",
          isMarketing
            ? "bg-transparent"
            : "border-fi-hairline border-b bg-white/80 backdrop-blur-[12px] backdrop-saturate-[1.4]",
        )}
      >
        <Logo className="mr-8 shrink-0" />

        {user && (
          <nav className="hidden items-center gap-1 max-[860px]:hidden min-[861px]:flex">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-normal transition-colors",
                  isActive(href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </a>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-4">
          {user ? (
            <>
              <span className="text-muted-foreground hidden text-sm min-[861px]:block">{user.email}</span>
              <div className="bg-fi-brand-dark hidden size-9 items-center justify-center rounded-full text-sm font-medium text-white min-[861px]:flex">
                {getInitial(user.email)}
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(true);
                }}
                className="text-muted-foreground hover:bg-accent flex size-9 items-center justify-center rounded-lg min-[861px]:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </button>
            </>
          ) : (
            <>
              <a href="/auth/signin" className="text-muted-foreground hover:text-foreground text-sm">
                Sign in
              </a>
              <Button size="sm" asChild>
                <a href="/auth/signup">Get started</a>
              </Button>
            </>
          )}
        </div>
      </header>

      {mobileOpen && user && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/40" onClick={closeMobile} aria-hidden="true" />
          <div className="absolute top-0 right-0 bottom-0 w-72 bg-white shadow-xl">
            <div className="border-fi-hairline flex h-16 items-center justify-between border-b px-6">
              <span className="text-fi-ink text-sm font-medium">{user.email}</span>
              <button
                type="button"
                onClick={closeMobile}
                className="text-muted-foreground hover:bg-accent flex size-8 items-center justify-center rounded-lg"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-4">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-normal transition-colors",
                    isActive(href)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                </a>
              ))}
              <div className="border-fi-hairline my-2 border-t" />
              <form method="POST" action="/api/auth/signout">
                <button
                  type="submit"
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors"
                >
                  <LogOut className="size-5" />
                  Sign out
                </button>
              </form>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
