import { useEffect, useState } from "react";
import type { CollectionWithCounts, PaginatedResponse, Flashcard } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/Tag";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { Flame, Clock, RectangleEllipsis, Sparkles, Layers, ChevronRight, Inbox } from "lucide-react";

interface DashboardViewProps {
  user: { email: string };
}

interface DashboardData {
  totalCards: number;
  totalDue: number;
  collections: CollectionWithCounts[];
}

function extractName(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function StatCard({
  icon,
  value,
  label,
  iconBg,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  iconBg: string;
}) {
  return (
    <Card className="gap-4 px-6 py-5">
      <div className={`flex size-10 items-center justify-center rounded-lg ${iconBg}`}>{icon}</div>
      <div>
        <p className="text-fi-ink text-[38px] leading-none font-light tracking-[-0.02em] tabular-nums">{value}</p>
        <p className="text-muted-foreground mt-1 text-[13px]">{label}</p>
      </div>
    </Card>
  );
}

function QuickActionCard({
  icon,
  iconBg,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a href={href} className="block">
      <Card className="group cursor-pointer gap-0 px-6 py-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]">
        <div className="flex items-center gap-4">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</div>
          <div className="min-w-0 flex-1">
            <p className="text-fi-ink text-[15px] font-medium">{title}</p>
            <p className="text-muted-foreground text-[13px]">{description}</p>
          </div>
          <ChevronRight className="text-muted-foreground size-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </a>
  );
}

function DueCollectionRow({ collection }: { collection: CollectionWithCounts }) {
  return (
    <div className="border-fi-hairline flex items-center gap-3 border-b py-3 last:border-b-0">
      <div className="bg-primary/12 flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Layers className="text-primary size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-fi-ink truncate text-[14px] font-medium">{collection.name}</p>
        <p className="text-muted-foreground text-[12px]">{collection.card_count} cards</p>
      </div>
      <span className="bg-primary/12 text-fi-primary-deep rounded-full px-2.5 py-0.5 text-[12px] font-medium tabular-nums">
        {collection.due_count} due
      </span>
      <a href={`/study/${collection.id}`}>
        <Button size="sm" className="h-8 px-4 text-[13px]">
          Study
        </Button>
      </a>
    </div>
  );
}

export default function DashboardView({ user }: DashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/flashcards?page=1&pageSize=1").then(async (res) => {
        if (!res.ok) throw new Error("Failed to load flashcards");
        return (await res.json()) as PaginatedResponse<Flashcard>;
      }),
      fetch("/api/collections").then(async (res) => {
        if (!res.ok) throw new Error("Failed to load collections");
        return (await res.json()) as CollectionWithCounts[];
      }),
    ])
      .then(([flashcardsResult, collections]) => {
        if (cancelled) return;
        const totalDue = collections.reduce((sum, c) => sum + c.due_count, 0);
        setData({
          totalCards: flashcardsResult.totalCount,
          totalDue,
          collections,
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <Spinner size={36} />
        <p className="text-muted-foreground text-[15px]">Loading dashboard…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={<Inbox className="text-primary size-8" />}
        title="Couldn't load dashboard"
        description={error ?? "Something went wrong."}
        action={
          <Button
            onClick={() => {
              window.location.reload();
            }}
            variant="outline"
          >
            Try again
          </Button>
        }
      />
    );
  }

  const name = extractName(user.email);
  const dueCollections = data.collections.filter((c) => c.due_count > 0);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Tag>Dashboard</Tag>
          <h1 className="text-fi-ink mt-3 text-[36px] leading-[1.15] font-light tracking-[-0.02em]">
            Good to see you,
            <br />
            {name}.
          </h1>
          {data.totalDue > 0 && (
            <p className="text-muted-foreground mt-1 text-[15px]">
              You have {data.totalDue} card{data.totalDue !== 1 ? "s" : ""} due for review today.
            </p>
          )}
        </div>
        <a href="/generate" className="mt-2">
          <Button className="gap-2">
            <Sparkles className="size-4" />
            Generate cards
          </Button>
        </a>
      </div>

      {/* Stat cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Flame className="text-primary size-5" />}
          iconBg="bg-primary/12"
          value={0}
          label="Studied today"
        />
        <StatCard
          icon={<Clock className="text-primary size-5" />}
          iconBg="bg-primary/12"
          value={data.totalDue}
          label="Cards due"
        />
        <StatCard
          icon={<RectangleEllipsis className="text-primary size-5" />}
          iconBg="bg-primary/12"
          value={data.totalCards}
          label="Total cards"
        />
      </div>

      {/* Quick actions + Due for review */}
      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* Quick actions */}
        <div>
          <h2 className="text-fi-ink mb-4 text-[20px] font-light tracking-[-0.01em]">Jump back in</h2>
          <div className="space-y-3">
            <QuickActionCard
              icon={<Sparkles className="text-primary size-5" />}
              iconBg="bg-primary/12"
              title="Generate with AI"
              description="Paste notes and turn them into a deck of cards."
              href="/generate"
            />
            <QuickActionCard
              icon={<RectangleEllipsis className="text-primary size-5" />}
              iconBg="bg-primary/12"
              title="My flashcards"
              description="Browse, search, edit and organize every card."
              href="/flashcards"
            />
            <QuickActionCard
              icon={<Layers className="text-primary size-5" />}
              iconBg="bg-primary/12"
              title="Collections & study"
              description="Pick a deck, start a timed spaced-repetition session."
              href="/study"
            />
          </div>
        </div>

        {/* Due for review */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-fi-ink text-[20px] font-light tracking-[-0.01em]">Due for review</h2>
            <a href="/study" className="text-primary text-[13px] font-medium hover:underline">
              All decks
            </a>
          </div>
          <Card className="gap-0 px-5 py-2">
            {dueCollections.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-[14px]">
                No cards due — you&apos;re all caught up!
              </p>
            ) : (
              dueCollections.map((collection) => <DueCollectionRow key={collection.id} collection={collection} />)
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
