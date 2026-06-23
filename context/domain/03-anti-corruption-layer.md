---
title: "FlipIt — Anti-Corruption Layer: ts-fsrs"
created: 2026-06-20
type: refactor-plan
target_dependency: ts-fsrs
sources:
  - context/foundation/prd.md
  - context/foundation/tech-stack.md
  - context/domain/01-domain-distillation.md
  - context/domain/02-invariant-aggregate-refactor.md
  - src/types.ts
  - src/lib/services/study.ts
  - src/components/study/StudySessionView.tsx
  - src/components/study/RatingButtons.tsx
  - src/pages/api/study/[id].ts
  - src/pages/api/study/review.ts
  - supabase/migrations/20260605120000_create_collections_and_sr_tables.sql
  - supabase/migrations/20260605180000_add_process_review_rpc.sql
---

# KROK 0 — Kontekst

## Wizja i stack

FlipIt to aplikacja spaced repetition z AI-generowaniem fiszek. Stack: Astro 6 SSR + React 19 islands, Supabase (auth + PostgreSQL), OpenRouter (LLM), `ts-fsrs` (algorytm SR), Cloudflare Workers.

## Warstwy kodu

| Warstwa        | Katalogi / pliki kluczowe                           |
| -------------- | --------------------------------------------------- |
| UI (React)     | `src/components/study/`, `src/components/generate/` |
| API (Astro)    | `src/pages/api/study/`                              |
| Serwisy        | `src/lib/services/`                                 |
| Typy domenowe  | `src/types.ts`                                      |
| Persystencja   | `supabase/migrations/`, RPC `process_review`        |
| Infrastruktura | `src/lib/supabase.ts`                               |

## Deklaracje o wymienialności

**PRD, `prd.md:114`:**

> "No custom SR algorithm — **use an existing spaced repetition library.** No custom scheduling research or novel algorithm development."

To zdanie traktuje bibliotekę SR jako **commodity** — dowolna istniejąca biblioteka SR powinna być wystarczająca. Intencja: wymienialność. Kod: głębokie sprzężenie.

**Domain distillation, `01-domain-distillation.md:34`:**

> `| SR | Biblioteka ts-fsrs | src/lib/services/study.ts |`

Zidentyfikowano ts-fsrs jako implementację Core subdomeny "Spaced Repetition Study".

## Zależności zewnętrzne (manifest)

| Zależność               | Rola                              | Warstwa docelowa |
| ----------------------- | --------------------------------- | ---------------- |
| `ts-fsrs`               | Algorytm spaced repetition (FSRS) | Serwis (+ UI!)   |
| `@supabase/supabase-js` | Klient bazy danych i auth         | Infra + serwisy  |
| `@supabase/ssr`         | SSR cookie helper                 | Infra            |
| OpenRouter (fetch)      | LLM API do generowania fiszek     | Serwis           |

---

# KROK 1 — Przeciekające zależności

## 1.1 `ts-fsrs` — import bezpośredni

| #   | Plik                                        | Linia | Import / użycie                          | Warstwa     |
| --- | ------------------------------------------- | ----- | ---------------------------------------- | ----------- |
| 1   | `src/lib/services/study.ts`                 | 3     | `import { fsrs } from "ts-fsrs"`         | SERWIS      |
| 2   | `src/components/study/StudySessionView.tsx` | 2     | `import { fsrs, Rating } from "ts-fsrs"` | UI (KLIENT) |

## 1.2 `ts-fsrs` — typy domenowe modelowane na kształcie biblioteki

| #   | Plik           | Linie | Typ                | Pola ts-fsrs w sygnaturze domenowej                                                                                   |
| --- | -------------- | ----- | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 3   | `src/types.ts` | 46–61 | `FlashcardSRState` | `difficulty`, `stability`, `elapsed_days`, `learning_steps`, `state` (0-3), `scheduled_days`                          |
| 4   | `src/types.ts` | 63–78 | `ReviewLog`        | `rating`, `state`, `difficulty`, `stability`, `elapsed_days`, `last_elapsed_days`, `learning_steps`, `scheduled_days` |
| 5   | `src/types.ts` | 80–94 | `StudyCard`        | Identyczne pola SR jak w `FlashcardSRState` + treść fiszki                                                            |
| 6   | `src/types.ts` | 96–99 | `IntervalPreview`  | `rating: number` — wartości 1-4 z enuma `ts-fsrs.Rating`                                                              |

Te typy nie importują `ts-fsrs` bezpośrednio, ale ich **kształt jest 1:1 kopią** typów `Card` i `ReviewLog` z `ts-fsrs`. Zmiana biblioteki SR wymaga zmiany tych typów, a przez to każdego konsumenta.

## 1.3 `ts-fsrs` — schemat DB

| #   | Plik                                                                      | Linie | Opis                                                                                                                                                  |
| --- | ------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | `supabase/migrations/20260605120000_create_collections_and_sr_tables.sql` | 42–57 | Tabela `flashcard_sr_state` — kolumny: `difficulty`, `stability`, `elapsed_days`, `learning_steps`, `scheduled_days`, `state` (ts-fsrs Card fields)   |
| 8   | `supabase/migrations/20260605120000_create_collections_and_sr_tables.sql` | 84–99 | Tabela `review_logs` — kolumny: `rating`, `state`, `difficulty`, `stability`, `elapsed_days`, `last_elapsed_days`, `scheduled_days`, `learning_steps` |
| 9   | `supabase/migrations/20260605180000_add_process_review_rpc.sql`           | 3–28  | RPC `process_review` — 20 parametrów o nazwach ts-fsrs                                                                                                |

## 1.4 `ts-fsrs` — rekonstrukcja obiektów biblioteki (duplikacja)

| #   | Plik                                        | Linie   | Rekonstrukcja                                                       |
| --- | ------------------------------------------- | ------- | ------------------------------------------------------------------- |
| 10  | `src/lib/services/study.ts`                 | 122–133 | Budowanie obiektu `currentCard` z pól `SRStateRow` → ts-fsrs `Card` |
| 11  | `src/components/study/StudySessionView.tsx` | 28–39   | Budowanie obiektu `cardInput` z pól `StudyCard` → ts-fsrs `Card`    |

**Te dwa fragmenty robią dokładnie to samo** — rekonstruują obiekt ts-fsrs Card z płaskich pól. Duplikacja logiki konwersji po obu stronach granicy klient/serwer.

## 1.5 `@supabase/supabase-js` — typ w sygnaturach serwisowych

| #   | Plik                              | Linia | Import                                                        |
| --- | --------------------------------- | ----- | ------------------------------------------------------------- |
| 12  | `src/lib/services/flashcards.ts`  | 1     | `import type { SupabaseClient } from "@supabase/supabase-js"` |
| 13  | `src/lib/services/study.ts`       | 1     | `import type { SupabaseClient } from "@supabase/supabase-js"` |
| 14  | `src/lib/services/collections.ts` | 1     | `import type { SupabaseClient } from "@supabase/supabase-js"` |

Serwisy biznesowe przyjmują `SupabaseClient` jako parametr DI — sprzężenie z infrastrukturą, ale na poziomie typu (nie wywołania). Priorytet niższy niż ts-fsrs.

## 1.6 OpenRouter — dobrze wyizolowane

| #   | Plik                             | Linia | Import / użycie                                                  |
| --- | -------------------------------- | ----- | ---------------------------------------------------------------- |
| 15  | `src/lib/services/openrouter.ts` | 1–4   | Fetch API + env vars; zwraca `FlashcardProposal[]`               |
| 16  | `src/pages/api/generations.ts`   | 3     | `import { generateFlashcards } from "@/lib/services/openrouter"` |

OpenRouter jest ograniczony do jednego pliku serwisowego + jednego API route. Zwraca typ domenowy. Izolacja poprawna.

---

# KROK 2 — Klasyfikacja i wybór #1

| Zależność             | (a) Warstwy / pliki dotknięte                                   | (b) Koszt wymiany                                                                                                         | (c) Deklaracja wymienialności                                       |
| --------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **ts-fsrs**           | **5 warstw, 11+ punktów** (UI, serwis, typy, DB schema, DB RPC) | **BARDZO WYSOKI** — wymiana wymaga zmian w: 1 komponencie React, 1 serwisie, 4 typach, 2 tabelach DB, 1 RPC, 2 API routes | **TAK** — `prd.md:114`: "use an existing spaced repetition library" |
| @supabase/supabase-js | 2 warstwy, 4 pliki (infra, serwisy)                             | ŚREDNI — serwisy sprzężone przez typ, ale nie przez logikę                                                                | BRAK deklaracji                                                     |
| OpenRouter            | 1 warstwa, 2 pliki                                              | NISKI — dobrze wyizolowane, typ zwracany jest domenowy                                                                    | POŚREDNIA — "calling an LLM provider"                               |

## Wybór: `ts-fsrs` — najgorszy przeciek

### Uzasadnienie

1. **Najszersze rozsmarowanie**: 5 warstw architektonicznych, 11+ punktów kontaktu. Żadna inna zależność nie jest nawet blisko.

2. **Rozjazd intencja vs kod**: PRD explicite mówi "use an existing spaced repetition library" (`prd.md:114`) — traktując bibliotekę SR jako commodity. Ale wymiana ts-fsrs na inną bibliotekę (np. SM-2, Anki scheduler, FSRS-5) wymaga zmian w **każdej warstwie** kodu, włącznie ze schematem DB i komponentem React.

3. **Biblioteka serwerowa w bundlu klienta**: `StudySessionView.tsx:2` importuje `fsrs` i `Rating` z `ts-fsrs`. To wciąga cały algorytm schedulingu do bundla JavaScript klienta — biblioteka zaprojektowana do obliczeń serwerowych ląduje w przeglądarce. Zwiększa rozmiar bundla i eksponuje logikę algorytmu.

4. **Zduplikowana logika konwersji**: Identyczna rekonstrukcja obiektu ts-fsrs `Card` z płaskich pól istnieje w dwóch miejscach: `study.ts:122-133` (serwer) i `StudySessionView.tsx:28-39` (klient). Zmiana kształtu danych wymaga synchronizacji dwóch kopii.

---

# KROK 3 — Diagnoza

## 3.1 Podwójny import — serwer i klient

### Serwer: `src/lib/services/study.ts:3,135-136`

```ts
import { fsrs } from "ts-fsrs";
// ...
const scheduler = fsrs();
const result = scheduler.next(currentCard, new Date(), rating);
```

Serwis tworzy instancję schedulera i oblicza nowy stan SR po review. To jest **właściwe miejsce** dla tej logiki — serwer odpowiada za persystencję stanu.

### Klient: `src/components/study/StudySessionView.tsx:2,27-47`

```ts
import { fsrs, Rating } from "ts-fsrs";

function computePreviews(card: StudyCard): IntervalPreview[] {
  const scheduler = fsrs();
  const cardInput = {
    difficulty: card.difficulty,
    due: new Date(card.due),
    elapsed_days: card.elapsed_days,
    // ... 7 kolejnych pól rekonstrukcji ...
  };
  const preview = scheduler.repeat(cardInput, new Date());
  return [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map((rating) => {
    const due = preview[rating].card.due as Date;
    return { rating, label: formatInterval(due) };
  });
}
```

Klient importuje `fsrs` i `Rating` WYŁĄCZNIE po to, żeby obliczyć podgląd interwałów dla 4 przycisków ratingu. To:

- **Wciąga bibliotekę serverową do bundla klienta** (runtime cost)
- **Duplikuje logikę konwersji** DB rows → ts-fsrs Card (identyczny mapping jak w `study.ts:122-133`)
- **Eksponuje enum `Rating`** z ts-fsrs w warstwie UI — klient "wie", że Again=1, Hard=2, Good=3, Easy=4 bo importuje je z ts-fsrs

### Groźność

Zmiana ts-fsrs na inną bibliotekę wymaga modyfikacji komponentu React, który jest bundlowany i dostarczany do przeglądarki. To nie jest problem infrastrukturalny — to problem **architektoniczny**: logika algorytmu SR nie powinna w ogóle istnieć po stronie klienta.

## 3.2 Typy domenowe = kopia typów biblioteki

### `src/types.ts:80-94` — `StudyCard`

```ts
export interface StudyCard {
  id: string;
  front: string;
  back: string;
  difficulty: number; // ts-fsrs Card.difficulty
  due: string; // ts-fsrs Card.due
  elapsed_days: number; // ts-fsrs Card.elapsed_days
  lapses: number; // ts-fsrs Card.lapses
  last_review: string | null; // ts-fsrs Card.last_review
  learning_steps: number; // ts-fsrs Card.learning_steps
  reps: number; // ts-fsrs Card.reps
  scheduled_days: number; // ts-fsrs Card.scheduled_days
  stability: number; // ts-fsrs Card.stability
  state: number; // ts-fsrs Card.state (0=New, 1=Learning, ...)
}
```

`StudyCard` to **1:1 kopia** pól `ts-fsrs Card`, rozszerzona o treść fiszki. Interfejs nie importuje ts-fsrs, ale jego kształt jest w 100% zdeterminowany przez tę bibliotekę. Pola jak `elapsed_days`, `learning_steps`, `stability` to nazewnictwo specyficzne dla FSRS — algorytm SM-2 używa `easiness_factor` i `interval`, Anki scheduler ma inne pola.

Ten typ jest w `src/types.ts` — pliku współdzielonym przez WSZYSTKIE warstwy. Zmiana nazw pól kaskaduje do: serwisów, API routes, komponentów React, DB queries.

### `src/types.ts:46-61` — `FlashcardSRState`

Identyczny problem — nazwy kolumn DB (`difficulty`, `stability`, `elapsed_days`, `learning_steps`, `scheduled_days`, `state`) są ts-fsrs-specyficzne.

### `src/types.ts:63-78` — `ReviewLog`

Pola `elapsed_days`, `last_elapsed_days`, `learning_steps`, `scheduled_days` — specyficzne dla ts-fsrs ReviewLog.

## 3.3 Schemat DB = ts-fsrs Card

### `20260605120000_create_collections_and_sr_tables.sql:42-57`

```sql
create table flashcard_sr_state (
  flashcard_id uuid primary key,
  difficulty float not null default 0,
  due timestamptz not null default now(),
  elapsed_days integer not null default 0,
  lapses integer not null default 0,
  last_review timestamptz,
  learning_steps integer not null default 0,
  reps integer not null default 0,
  scheduled_days integer not null default 0,
  stability float not null default 0,
  state smallint not null default 0,
  -- ...
);
```

10 kolumn danych SR, każda nazwana identycznie jak pole w `ts-fsrs Card`. To najgłębsza warstwa sprzężenia — schema DB jest "wylana z formy" ts-fsrs.

### `20260605180000_add_process_review_rpc.sql:3-28`

RPC `process_review` ma **20 parametrów** o nazwach ts-fsrs (`p_difficulty`, `p_stability`, `p_elapsed_days`, `p_learning_steps`, `p_log_rating`, `p_log_elapsed_days`, `p_log_last_elapsed_days` itd.). Interfejs RPC jest wierną kopią interfejsu ts-fsrs.

## 3.4 Rozjazd intencja vs kod — podsumowanie

**Dokument deklaruje (`prd.md:114`):**

> "use an existing spaced repetition library"

**Kod robi:**

- ts-fsrs jest importowany w 2 warstwach (serwis, UI)
- Typy domenowe w `types.ts` odwzorowują 1:1 kształt ts-fsrs `Card` i `ReviewLog`
- Schemat DB (10 kolumn + 20-parametrowe RPC) używa nazw pól ts-fsrs
- Logika konwersji DB→ts-fsrs jest zduplikowana w serwisie i kliencie
- **Wymiana ts-fsrs wymaga zmian w 11+ punktach w 5 warstwach**

Koszt wymiany jest **nieadekwatny** do deklaracji o commodity.

## 3.5 Mapa przecieków

```
┌─────────────────────────────────────────────────────────────────┐
│  WARSTWA UI (React)                                              │
│  StudySessionView.tsx:2  ──── import { fsrs, Rating }           │
│  StudySessionView.tsx:28-39 ── rekonstrukcja ts-fsrs Card       │
│  RatingButtons.tsx:4-25  ──── wartości 1-4 (ts-fsrs Rating)    │
├─────────────────────────────────────────────────────────────────┤
│  WARSTWA API (Astro)                                             │
│  study/[id].ts:45        ──── zwraca StudyCard (ts-fsrs shape)  │
│  study/review.ts:9       ──── rating 1-4 (ts-fsrs Rating enum) │
├─────────────────────────────────────────────────────────────────┤
│  WARSTWA SERWIS                                                  │
│  study.ts:3              ──── import { fsrs }                   │
│  study.ts:122-133        ──── rekonstrukcja ts-fsrs Card        │
│  study.ts:135-136        ──── fsrs().next(card, date, rating)   │
│  study.ts:142-168        ──── mapowanie result → RPC params     │
├─────────────────────────────────────────────────────────────────┤
│  WARSTWA TYPY DOMENOWE                                           │
│  types.ts:46-61          ──── FlashcardSRState (ts-fsrs Card)   │
│  types.ts:63-78          ──── ReviewLog (ts-fsrs ReviewLog)     │
│  types.ts:80-94          ──── StudyCard (ts-fsrs Card + content)│
│  types.ts:96-99          ──── IntervalPreview (ts-fsrs Rating)  │
├─────────────────────────────────────────────────────────────────┤
│  WARSTWA PERSYSTENCJA (DB)                                       │
│  flashcard_sr_state      ──── 10 kolumn = ts-fsrs Card fields   │
│  review_logs             ──── 8 kolumn = ts-fsrs ReviewLog      │
│  process_review RPC      ──── 20 params = ts-fsrs field names   │
└─────────────────────────────────────────────────────────────────┘
```

---

# KROK 4 — Projekt ACL

## 4.1 Zasada

Jedyne miejsce, które "wie" o ts-fsrs, to **adapter** w katalogu `src/lib/scheduling/`. Reszta kodu operuje na domenowych typach i interfejsie portu. Adapter mapuje między kształtem domeny a kształtem biblioteki.

## 4.2 Domenowy Value Object — `SchedulingSnapshot`

```ts
// src/lib/scheduling/types.ts

/**
 * Domenowy snapshot stanu SR fiszki.
 * Niezależny od konkretnej biblioteki — pola opisują CO domena potrzebuje,
 * nie JAK algorytm to oblicza.
 */
export interface SchedulingSnapshot {
  /** Kiedy fiszka jest due do powtórki */
  due: Date;
  /** Faza nauki: new → learning → review → relearning */
  phase: CardPhase;
  /** Ile razy poprawnie odpowiedziano */
  reps: number;
  /** Ile razy "przepadła" (rating=Again po review) */
  lapses: number;
  /** Ostatnia powtórka (null jeśli nowa karta) */
  lastReview: Date | null;
  /**
   * Opaque blob algorytmu — serializowane przez adapter,
   * przechowywane jako JSONB w DB.
   * Domena NIE zagląda do środka.
   */
  algorithmState: Record<string, unknown>;
}

export type CardPhase = "new" | "learning" | "review" | "relearning";

/** Domenowy rating — niezależny od enuma biblioteki */
export type DomainRating = 1 | 2 | 3 | 4;

export const RATING_LABELS: Record<DomainRating, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

/** Podgląd interwału dla przycisku ratingu */
export interface IntervalPreview {
  rating: DomainRating;
  label: string;
}

/** Log oceny — zapis audytowy */
export interface ReviewRecord {
  rating: DomainRating;
  reviewedAt: Date;
  schedulingBefore: SchedulingSnapshot;
  schedulingAfter: SchedulingSnapshot;
}
```

**Kluczowe decyzje:**

- `algorithmState: Record<string, unknown>` — opaque blob. Dla ts-fsrs zawiera `{ difficulty, stability, elapsed_days, learning_steps, scheduled_days, state }`. Dla SM-2 zawierałby `{ easiness_factor, interval }`. Domena nie rozpakowuje tego — robi to tylko adapter.
- `phase: CardPhase` — domena zna fazę karty (potrzebna do UI, filtrowania), ale nie wie, jak algorytm ją oblicza.
- `DomainRating = 1 | 2 | 3 | 4` — domena definiuje skalę, nie importuje enuma z biblioteki.

## 4.3 Port — `SRScheduler`

```ts
// src/lib/scheduling/port.ts

import type { SchedulingSnapshot, DomainRating, IntervalPreview, ReviewRecord } from "./types";

/**
 * Port schedulera SR — jedyny interfejs, przez który domena wchodzi
 * w interakcję z algorytmem spaced repetition.
 * Adapter implementujący ten port jest jedynym miejscem importującym ts-fsrs.
 */
export interface SRScheduler {
  /** Tworzy początkowy snapshot dla nowej fiszki */
  createInitial(): SchedulingSnapshot;

  /**
   * Oblicza nowy snapshot po ocenie.
   * Zwraca nowy stan + dane do review log.
   */
  processRating(
    current: SchedulingSnapshot,
    rating: DomainRating,
    now?: Date,
  ): { next: SchedulingSnapshot; record: ReviewRecord };

  /**
   * Podgląd interwałów dla wszystkich ratingów — do wyświetlenia
   * na przyciskach UI ("Again: <1m", "Good: 3d", itd.)
   */
  previewIntervals(current: SchedulingSnapshot, now?: Date): IntervalPreview[];
}
```

## 4.4 Adapter — `TsFsrsScheduler`

```ts
// src/lib/scheduling/adapters/ts-fsrs-adapter.ts

import { fsrs, Rating, State } from "ts-fsrs";
import type { SRScheduler } from "../port";
import type { SchedulingSnapshot, DomainRating, CardPhase, IntervalPreview, ReviewRecord } from "../types";

// ↑ JEDYNY plik w kodzie, który importuje "ts-fsrs"

const RATING_MAP: Record<DomainRating, Rating> = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy,
};

const PHASE_MAP: Record<number, CardPhase> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

function toCardPhase(state: number): CardPhase {
  return PHASE_MAP[state] ?? "new";
}

/** Mapowanie: SchedulingSnapshot → ts-fsrs Card */
function toFsrsCard(snapshot: SchedulingSnapshot) {
  const algo = snapshot.algorithmState as {
    difficulty: number;
    stability: number;
    elapsed_days: number;
    learning_steps: number;
    scheduled_days: number;
    state: number;
  };
  return {
    difficulty: algo.difficulty,
    due: snapshot.due,
    elapsed_days: algo.elapsed_days,
    lapses: snapshot.lapses,
    last_review: snapshot.lastReview ?? undefined,
    learning_steps: algo.learning_steps,
    reps: snapshot.reps,
    scheduled_days: algo.scheduled_days,
    stability: algo.stability,
    state: algo.state,
  };
}

/** Mapowanie: ts-fsrs Card → SchedulingSnapshot */
function fromFsrsCard(card: ReturnType<typeof toFsrsCard>): SchedulingSnapshot {
  return {
    due: card.due instanceof Date ? card.due : new Date(card.due),
    phase: toCardPhase(card.state),
    reps: card.reps,
    lapses: card.lapses,
    lastReview: card.last_review ? new Date(card.last_review) : null,
    algorithmState: {
      difficulty: card.difficulty,
      stability: card.stability,
      elapsed_days: card.elapsed_days,
      learning_steps: card.learning_steps,
      scheduled_days: card.scheduled_days,
      state: card.state,
    },
  };
}

function formatInterval(due: Date): string {
  const diffMs = due.getTime() - Date.now();
  if (diffMs < 60_000) return "<1m";
  if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m`;
  if (diffMs < 86_400_000) return `${Math.round(diffMs / 3_600_000)}h`;
  return `${Math.round(diffMs / 86_400_000)}d`;
}

export function createTsFsrsScheduler(): SRScheduler {
  const scheduler = fsrs();

  return {
    createInitial(): SchedulingSnapshot {
      return {
        due: new Date(),
        phase: "new",
        reps: 0,
        lapses: 0,
        lastReview: null,
        algorithmState: {
          difficulty: 0,
          stability: 0,
          elapsed_days: 0,
          learning_steps: 0,
          scheduled_days: 0,
          state: State.New,
        },
      };
    },

    processRating(current, rating, now = new Date()) {
      const card = toFsrsCard(current);
      const result = scheduler.next(card, now, RATING_MAP[rating]);
      const next = fromFsrsCard(result.card);
      return {
        next,
        record: {
          rating,
          reviewedAt: now,
          schedulingBefore: current,
          schedulingAfter: next,
        },
      };
    },

    previewIntervals(current, now = new Date()) {
      const card = toFsrsCard(current);
      const preview = scheduler.repeat(card, now);
      return ([1, 2, 3, 4] as DomainRating[]).map((rating) => {
        const due = preview[RATING_MAP[rating]].card.due as Date;
        return { rating, label: formatInterval(due) };
      });
    },
  };
}
```

## 4.5 Persystencja — mapowanie DB ↔ SchedulingSnapshot

```ts
// src/lib/scheduling/persistence.ts

import type { SchedulingSnapshot, CardPhase } from "./types";

const PHASE_TO_STATE: Record<CardPhase, number> = {
  new: 0,
  learning: 1,
  review: 2,
  relearning: 3,
};
const STATE_TO_PHASE: Record<number, CardPhase> = {
  0: "new",
  1: "learning",
  2: "review",
  3: "relearning",
};

/** Wiersz DB flashcard_sr_state → SchedulingSnapshot */
export function fromDbRow(row: {
  difficulty: number;
  due: string;
  elapsed_days: number;
  lapses: number;
  last_review: string | null;
  learning_steps: number;
  reps: number;
  scheduled_days: number;
  stability: number;
  state: number;
}): SchedulingSnapshot {
  return {
    due: new Date(row.due),
    phase: STATE_TO_PHASE[row.state] ?? "new",
    reps: row.reps,
    lapses: row.lapses,
    lastReview: row.last_review ? new Date(row.last_review) : null,
    algorithmState: {
      difficulty: row.difficulty,
      stability: row.stability,
      elapsed_days: row.elapsed_days,
      learning_steps: row.learning_steps,
      scheduled_days: row.scheduled_days,
      state: row.state,
    },
  };
}

/** SchedulingSnapshot → płaskie pola do INSERT/UPDATE w DB */
export function toDbFields(snapshot: SchedulingSnapshot): {
  difficulty: number;
  due: string;
  elapsed_days: number;
  lapses: number;
  last_review: string | null;
  learning_steps: number;
  reps: number;
  scheduled_days: number;
  stability: number;
  state: number;
} {
  const algo = snapshot.algorithmState as Record<string, number>;
  return {
    difficulty: algo.difficulty,
    due: snapshot.due.toISOString(),
    elapsed_days: algo.elapsed_days,
    lapses: snapshot.lapses,
    last_review: snapshot.lastReview?.toISOString() ?? null,
    learning_steps: algo.learning_steps,
    reps: snapshot.reps,
    scheduled_days: algo.scheduled_days,
    stability: algo.stability,
    state: algo.state ?? PHASE_TO_STATE[snapshot.phase],
  };
}
```

**Uwaga o DB:** Nazwy kolumn (`difficulty`, `stability` itd.) pozostają — zmiana nazw kolumn w produkcyjnej DB to zbyt duże ryzyko. Mapowanie kolumna → algorithmState blob żyje w `persistence.ts`. Przy wymianie algorytmu mapowanie się zmieni, ale kolumny mogą zostać (lub dodać nowe kolumny + migracja danych). Kluczowe: reszta kodu nie odwołuje się do tych nazw kolumn bezpośrednio.

## 4.6 Struktura katalogów po refaktorze

```
src/lib/scheduling/
├── types.ts              ← SchedulingSnapshot, DomainRating, IntervalPreview, ReviewRecord
├── port.ts               ← SRScheduler interface
├── persistence.ts        ← fromDbRow / toDbFields (mapowanie DB ↔ snapshot)
└── adapters/
    └── ts-fsrs-adapter.ts ← JEDYNY plik importujący "ts-fsrs"
```

---

# KROK 5 — Dowód izolacji + before/after

## 5.1 Dowód izolacji

### Scenariusz: wymiana ts-fsrs na bibliotekę X (np. SM-2, custom FSRS-5)

| Warstwa / plik                   | Przed ACL: dotknięta?       | Po ACL: dotknięta?                                         |
| -------------------------------- | --------------------------- | ---------------------------------------------------------- |
| `StudySessionView.tsx` (UI)      | **TAK** — import + logika   | **NIE** — dostaje gotowe `IntervalPreview[]` z API         |
| `RatingButtons.tsx` (UI)         | **TAK** — wartości z Rating | **NIE** — dostaje domenowy `DomainRating`                  |
| `study/[id].ts` (API)            | pośrednio (StudyCard shape) | **NIE** — zwraca domenowe typy                             |
| `study/review.ts` (API)          | pośrednio (rating 1-4)      | **NIE** — `DomainRating` jest w domenie                    |
| `study.ts` (serwis)              | **TAK** — import + logika   | **NIE** — woła `SRScheduler` port                          |
| `types.ts` (typy)                | **TAK** — 4 interfejsy      | **NIE** — typy SR przeniesione do `scheduling/types.ts`    |
| `flashcard_sr_state` (DB tabela) | **TAK** — kolumny           | **NIE** — mapowanie w `persistence.ts`                     |
| `process_review` (DB RPC)        | **TAK** — parametry         | **NIE** — serwis buduje params przez `toDbFields`          |
| **ts-fsrs-adapter.ts** (adapter) | —                           | **TAK — JEDYNY plik do zmiany**                            |
| `persistence.ts` (mapowanie DB)  | —                           | **MOŻE** — jeśli nowy algorytm ma inne pola niż kolumny DB |

### Weryfikacja grep:

**Przed refaktorem** — `grep "ts-fsrs"` zwraca:

- `src/lib/services/study.ts`
- `src/components/study/StudySessionView.tsx`

**Po refaktorze** — `grep "ts-fsrs"` powinien zwracać WYŁĄCZNIE:

- `src/lib/scheduling/adapters/ts-fsrs-adapter.ts`
- `package.json` (deklaracja zależności)

## 5.2 Before/After

### Miejsce 1: Preview interwałów (klient → serwer)

**BEFORE** — `StudySessionView.tsx:2,26-48`:

```ts
// ❌ Klient importuje ts-fsrs, rekonstruuje Card, oblicza previews
import { fsrs, Rating } from "ts-fsrs";

function computePreviews(card: StudyCard): IntervalPreview[] {
  const scheduler = fsrs();
  const cardInput = { difficulty: card.difficulty, due: new Date(card.due) /* ... 8 pól */ };
  const preview = scheduler.repeat(cardInput, new Date());
  return [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map((r) => ({
    rating: r,
    label: formatInterval(preview[r].card.due as Date),
  }));
}
```

**AFTER** — `StudySessionView.tsx`:

```ts
// ✅ Klient dostaje gotowe previews z API, zero importów ts-fsrs
async function fetchPreviews(flashcardId: string): Promise<IntervalPreview[]> {
  const res = await fetch(`/api/study/preview/${flashcardId}`);
  return (await res.json()) as IntervalPreview[];
}
```

Nowy endpoint `GET /api/study/preview/[id]`:

```ts
// src/pages/api/study/preview/[id].ts
// Serwer oblicza previews przez port SRScheduler
const snapshot = fromDbRow(srStateRow);
const previews = scheduler.previewIntervals(snapshot);
return Response.json(previews);
```

### Miejsce 2: Przetwarzanie review (serwis)

**BEFORE** — `study.ts:3,122-168`:

```ts
// ❌ Serwis importuje ts-fsrs, rekonstruuje Card, mapuje 20 pól RPC
import { fsrs } from "ts-fsrs";

const currentCard = {
  difficulty: srState.difficulty,
  due: new Date(srState.due),
  /* ...8 pól rekonstrukcji... */
};
const scheduler = fsrs();
const result = scheduler.next(currentCard, new Date(), rating);
// ...mapowanie 20 pól do RPC parametrów...
```

**AFTER** — `study.ts`:

```ts
// ✅ Serwis woła port, mapowanie żyje w adapterze i persistence
import type { SRScheduler } from "@/lib/scheduling/port";
import { fromDbRow, toDbFields } from "@/lib/scheduling/persistence";

const snapshot = fromDbRow(srState);
const { next, record } = scheduler.processRating(snapshot, rating);
const dbFields = toDbFields(next);
// ...RPC z dbFields...
```

### Miejsce 3: Typy domenowe

**BEFORE** — `types.ts:80-94`:

```ts
// ❌ StudyCard ma 10 pól ts-fsrs wklejonych do typu domenowego
export interface StudyCard {
  id: string;
  front: string;
  back: string;
  difficulty: number;
  due: string;
  elapsed_days: number;
  lapses: number;
  last_review: string | null;
  learning_steps: number;
  reps: number;
  scheduled_days: number;
  stability: number;
  state: number;
}
```

**AFTER** — `types.ts` + `scheduling/types.ts`:

```ts
// ✅ StudyCard zna domenowe pojęcia, nie pola ts-fsrs
export interface StudyCard {
  id: string;
  front: string;
  back: string;
  scheduling: SchedulingSnapshot;
}
```

UI dostaje `StudyCard` z zagnieżdżonym `SchedulingSnapshot`. Preview interwałów przychodzi z API jako `IntervalPreview[]`. Klient nie musi "rozpakowywać" stanu SR.

### Miejsce 4: Enum Rating

**BEFORE** — `StudySessionView.tsx:2`:

```ts
import { Rating } from "ts-fsrs";
// ... Rating.Again, Rating.Hard, Rating.Good, Rating.Easy
```

**AFTER**:

```ts
import { RATING_LABELS } from "@/lib/scheduling/types";
import type { DomainRating } from "@/lib/scheduling/types";
// ... 1, 2, 3, 4 z RATING_LABELS
```

Klient nie importuje ts-fsrs. Wartości ratingów (1-4) i ich etykiety ("Again", "Hard", "Good", "Easy") są zdefiniowane w domenie, nie w bibliotece.

## 5.3 Otwarte pytanie: API preview endpoint

Przeniesienie `computePreviews` z klienta na serwer wprowadza dodatkowy round-trip (fetch `GET /api/study/preview/[id]`). Decyzja: **zakodować w ACL**, nie w warstwie API.

Opcja A (rekomendowana): Serwer zwraca previews razem z kartami due w `GET /api/study/[id]`, eliminując osobny request.

```ts
// GET /api/study/[id] — response po refaktorze
{
  cards: [
    {
      id: "...", front: "...", back: "...",
      scheduling: { due: "...", phase: "review", ... },
      previews: [
        { rating: 1, label: "<1m" },
        { rating: 2, label: "6m" },
        { rating: 3, label: "3d" },
        { rating: 4, label: "9d" }
      ]
    }
  ],
  nextDue: "..."
}
```

Opcja B: Lazy-load previews po flip (osobny endpoint). Mniejszy payload, ale dodatkowy request.

Decyzja powinna być zakodowana w serwisie `study.ts` (przez port `previewIntervals`), **nie w komponencie React**.

---

# KROK 6 — Weryfikacja i plan faz

## 6.1 Kryterium sukcesu

`grep -r "ts-fsrs" src/` zwraca **wyłącznie**:

- `src/lib/scheduling/adapters/ts-fsrs-adapter.ts`

Nie zwraca:

- `src/lib/services/study.ts` ← dziś: tak
- `src/components/study/StudySessionView.tsx` ← dziś: tak

## 6.2 Pliki, które dziś znają ts-fsrs, a po refaktorze nie

| Plik                                             | Dziś zna ts-fsrs?   | Po refaktorze?                  |
| ------------------------------------------------ | ------------------- | ------------------------------- |
| `src/lib/services/study.ts`                      | TAK (import)        | **NIE** — woła port SRScheduler |
| `src/components/study/StudySessionView.tsx`      | TAK (import)        | **NIE** — dostaje dane z API    |
| `src/types.ts`                                   | POŚREDNIO (kształt) | **NIE** — typy SR w scheduling/ |
| `src/pages/api/study/[id].ts`                    | POŚREDNIO (wire)    | **NIE** — zwraca domenowe typy  |
| `src/pages/api/study/review.ts`                  | POŚREDNIO (wire)    | **NIE** — rating z domeny       |
| `src/lib/scheduling/adapters/ts-fsrs-adapter.ts` | —                   | **TAK — jedyny punkt kontaktu** |

## 6.3 Plan faz

### Faza 1: Typy i port (zero zmian w kodzie produkcyjnym)

1. Stworzyć `src/lib/scheduling/types.ts` — `SchedulingSnapshot`, `DomainRating`, `IntervalPreview`, `ReviewRecord`
2. Stworzyć `src/lib/scheduling/port.ts` — interfejs `SRScheduler`
3. Stworzyć `src/lib/scheduling/persistence.ts` — `fromDbRow`, `toDbFields`
4. Testy jednostkowe `persistence.ts` (roundtrip: snapshot → dbFields → snapshot)

### Faza 2: Adapter ts-fsrs

1. Stworzyć `src/lib/scheduling/adapters/ts-fsrs-adapter.ts` — `createTsFsrsScheduler()`
2. Testy jednostkowe adaptera:
   - `createInitial()` → snapshot z phase=new, due≈now
   - `processRating(initial, 3)` → next.phase zmienia się, due przesuwa się w przyszłość
   - `previewIntervals(initial)` → 4 wpisy, rating 1-4, labels niepuste
   - roundtrip: `processRating` result → `toDbFields` → `fromDbRow` → porównanie snapshot
3. Wyeksportować factory: `src/lib/scheduling/index.ts`

### Faza 3: Serwis study.ts

1. Zrefaktorować `getDueCards`: wynik mapowany przez `fromDbRow`, zwraca `StudyCard` z `SchedulingSnapshot`
2. Zrefaktorować `processReview`: woła `scheduler.processRating()` + `toDbFields()` zamiast `fsrs().next()`
3. Dodać `getPreviewsForCard`: woła `scheduler.previewIntervals()` — nowa funkcja serwisowa
4. Usunąć `import { fsrs } from "ts-fsrs"` z `study.ts`
5. Istniejące testy serwisowe — zaktualizować

### Faza 4: API routes

1. Rozszerzyć `GET /api/study/[id]` — response zawiera `previews` per card (Opcja A z 5.3)
2. Zaktualizować `POST /api/study/review` — używa domenowych typów
3. Opcjonalnie: dodać `GET /api/study/preview/[id]` (Opcja B)
4. Zaktualizować typy wire format w `types.ts` — `StudyCard` z `SchedulingSnapshot`

### Faza 5: UI

1. Usunąć `import { fsrs, Rating } from "ts-fsrs"` z `StudySessionView.tsx`
2. Usunąć funkcję `computePreviews` — previews przychodzą z API
3. Zaktualizować `RatingButtons` — `DomainRating` z `scheduling/types.ts`
4. Sprawdzić, że bundle klienta **nie zawiera** ts-fsrs (build + analiza)

### Faza 6: Cleanup typów

1. Przenieść `FlashcardSRState`, `ReviewLog` z `types.ts` do `scheduling/` (jeśli jeszcze używane, wyexportować re-export)
2. Uprościć `StudyCard` w `types.ts` — bez płaskich pól SR
3. Usunąć stary `IntervalPreview` z `types.ts` (przeniesiony do `scheduling/types.ts`)
4. Grep weryfikacja: `grep -r "ts-fsrs" src/` → tylko `adapters/ts-fsrs-adapter.ts`

---

# Podsumowanie

Biblioteka `ts-fsrs` jest najgorzej izolowaną zależnością w FlipIt — przecieka przez 5 warstw architektury (UI React, API Astro, serwisy, typy domenowe, schemat DB) w 11+ punktach kontaktu. PRD explicite deklaruje SR library jako commodity ("use an existing spaced repetition library", `prd.md:114`), ale koszt wymiany jest nieadekwatnie wysoki: wymaga zmian w komponencie React (który importuje ts-fsrs do bundla klienta), serwisie, 4 interfejsach typów, i 20-parametrowym RPC. Najbardziej groźny objaw to import biblioteki serverowej do bundla przeglądarki (`StudySessionView.tsx:2`) wyłącznie w celu obliczenia podglądu interwałów. Zaprojektowany ACL wprowadza domenowy value object `SchedulingSnapshot`, port `SRScheduler` i adapter `TsFsrsScheduler` — po refaktorze `grep "ts-fsrs" src/` zwraca wyłącznie `src/lib/scheduling/adapters/ts-fsrs-adapter.ts`. Refaktor jest podzielony na 6 faz: typy+port → adapter → serwis → API → UI → cleanup, z kryterium sukcesu weryfikowalnym jednym poleceniem grep.
