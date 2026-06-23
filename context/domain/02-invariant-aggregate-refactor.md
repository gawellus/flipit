---
title: "FlipIt — Invariant Aggregate Refactor: StudyableFlashcard"
created: 2026-06-20
type: refactor-plan
invariant: "Every saved flashcard must be reachable by the study system"
sources:
  - context/domain/01-domain-distillation.md
  - context/foundation/prd.md
  - context/foundation/roadmap.md
  - src/types.ts
  - src/lib/services/flashcards.ts
  - src/lib/services/study.ts
  - src/lib/services/collections.ts
  - src/pages/api/flashcards.ts
  - src/pages/api/generations.ts
  - src/pages/api/study/[id].ts
  - src/components/generate/FlashcardReview.tsx
  - src/components/flashcards/CreateFlashcardForm.tsx
  - supabase/migrations/20260605120000_create_collections_and_sr_tables.sql
---

# KROK 0 — Kontekst

## Wizja produktu

FlipIt to aplikacja spaced repetition, której wartość opiera się na pętli: **wklej tekst → AI generuje fiszki → przejrzyj/zaakceptuj → zapisz → ucz się z SR**. Guardrail PRD: _"Study progress is never lost — SR scheduling state and card edits persist reliably across sessions"_ (`prd.md:44`). North star roadmapy: _"completing S-03 closes the full product loop"_ (`roadmap.md:24`).

## Stack i warstwy

| Warstwa      | Pliki kluczowe                                                                               | Rola w niezmienniku                                |
| ------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| UI (React)   | `GenerateView.tsx`, `FlashcardReview.tsx`, `CreateFlashcardForm.tsx`, `StudySessionView.tsx` | Tworzy fiszki (bez kolekcji), inicjuje sesje nauki |
| API (Astro)  | `flashcards.ts`, `generations.ts`, `study/[id].ts`, `study/review.ts`                        | Walidacja Zod, routing                             |
| Serwisy      | `flashcards.ts`, `study.ts`, `collections.ts`                                                | Logika CRUD i SR                                   |
| Persystencja | migracje SQL, RPC `process_review`                                                           | Trigger SR state, atomowy review                   |

## Dokument 01

Analiza 01 (`context/domain/01-domain-distillation.md`) zidentyfikowała problem **D5 (Orphan Flashcards)** jako priorytet #1. Niniejszy dokument rozwija go w pełny plan refaktoru z diagnozą i projektem agregatu.

---

# KROK 1 — Niezmienniki biznesowe

| ID         | Reguła                                                                        | Źródło                                                         |
| ---------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| INV-01     | Flashcard ma niepusty `front` i `back`, każdy 1–2000 znaków                   | `prd.md:104`; Zod `flashcards.ts:12-15`; DB `text not null`    |
| INV-02     | `source = "ai"` wymaga `generation_id`; `source = "manual"` zabrania go       | Zod refine `flashcards.ts:21-26`                               |
| INV-03     | `source` to `"ai"` lub `"manual"`                                             | DB CHECK, Zod enum, TS union                                   |
| INV-04     | Każda fiszka **musi** mieć rekord SR state (1:1)                              | `prd.md:44` (guardrail); trigger `20260605120000:115-127`      |
| INV-05     | Review jest atomowy — update SR state + insert review log w jednej transakcji | `prd.md:44`; RPC `process_review` (`20260605180000:1-73`)      |
| INV-06     | Użytkownik widzi tylko swoje dane (tenant isolation)                          | `prd.md:111`; RLS na każdej tabeli; middleware                 |
| INV-07     | Rating to 1–4 (Again, Hard, Good, Easy)                                       | ts-fsrs; Zod `review.ts:9`                                     |
| INV-08     | Fiszka należy do max 1 kolekcji (nullable FK)                                 | `20260605120000:36-37`                                         |
| INV-09     | Usunięcie kolekcji nie kasuje fiszek (`ON DELETE SET NULL`)                   | `20260605120000:37`                                            |
| **INV-10** | **Zapisana fiszka musi być osiągalna dla systemu nauki (studyable)**          | **Implikowany** przez `prd.md:44` + north star `roadmap.md:24` |

---

# KROK 2 — Klasyfikacja i wybór #1

| ID         | (a) Rdzeniowość                         | (b) Rozsmarowanie                     | (c) Egzekwowanie                                      |
| ---------- | --------------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| INV-01     | WYSOKA — fiszka to rdzeń produktu       | 4 warstwy (UI×2, API, DB)             | CZĘŚCIOWE — DB ma `NOT NULL`, ale bez limitu długości |
| INV-02     | ŚREDNIA — traceability                  | 1 warstwa (API Zod refine)            | CZĘŚCIOWE — tylko API, DB bez constraintu             |
| INV-03     | NISKA — kosmetyczna                     | 3 warstwy                             | SILNE — DB CHECK + Zod + TS                           |
| INV-04     | KRYTYCZNA — SR to produkt               | 2 warstwy (DB trigger, serwis)        | ŚREDNIE — trigger działa, ale serwis nie weryfikuje   |
| INV-05     | KRYTYCZNA — "progress never lost"       | 1 warstwa (DB RPC)                    | SILNE — PostgreSQL transakcja                         |
| INV-06     | WYSOKA — bezpieczeństwo                 | 4 warstwy                             | SILNE — wielowarstwowe                                |
| INV-07     | ŚREDNIA — input validation              | 1 warstwa (API Zod)                   | CZĘŚCIOWE — DB bez constraintu                        |
| INV-08     | NISKA — organizacja                     | 1 warstwa (DB FK)                     | SILNE — FK + nullable                                 |
| INV-09     | NISKA — cascade behavior                | 1 warstwa (DB)                        | SILNE — DB ON DELETE SET NULL                         |
| **INV-10** | **KRYTYCZNA** — pętla wartości produktu | **5+ warstw** (UI, API, serwis×2, DB) | **NIEEGZEKWOWANY** — aktywnie naruszany               |

## Wybór: INV-10 — "Zapisana fiszka musi być osiągalna dla systemu nauki"

### Uzasadnienie

**INV-10 jest jednocześnie najbardziej rdzeniowy I najsłabiej egzekwowany — jedyny niezmiennik, który jest aktywnie NARUSZANY w produkcji.**

**(a) Rdzeniowość:** Cała propozycja wartości produktu to pętla paste → generate → save → study. Jeśli po zapisie fiszka nie trafia do systemu nauki, pętla jest przerwana. PRD guardrail mówi _"Study progress is never lost"_ — ale fiszki bez kolekcji są "martwe" w systemie, nie tracone przez błąd, lecz z designu.

**(b) Rozsmarowanie:** Reguła jest rozproszona po wszystkich warstwach, ale nigdzie nie jest jawnie zadeklarowana:

- UI: brak collection pickera w flow generowania i tworzenia
- API: schemat Zod nie wymaga `collection_id`
- Serwis `createFlashcards`: nie przypisuje kolekcji
- Serwis `getDueCards`: wymaga `collectionId` — filtruje fiszki bez kolekcji
- DB: `collection_id` jest nullable (pozwala na orphanów)

**(c) Egzekwowanie:** **Zerowe.** Nie ma żadnej warstwy, która pilnowałaby, że fiszka po zapisie jest studyable. Co gorsza, system aktywnie produkuje orphanów — domyślny flow (generate → save) tworzy fiszki z `collection_id = null`.

---

# KROK 3 — Diagnoza

## 3.1 Ścieżka generowania AI (flow główny)

### UI — `src/components/generate/FlashcardReview.tsx:54-59`

```ts
body: JSON.stringify({
  generation_id: generationId,
  flashcards: accepted.map((c) => ({ front: c.proposal.front, back: c.proposal.back })),
}),
```

**Brak `collection_id` w payloadzie.** UI nie daje użytkownikowi możliwości wybrania kolekcji w momencie zapisu zaakceptowanych fiszek.

### API — `src/pages/api/flashcards.ts:7-27`

```ts
export const SaveFlashcardsSchema = z.object({
  generation_id: z.uuid(...).optional(),
  source: z.enum(["ai", "manual"]).default("ai"),
  flashcards: z.array(z.object({
    front: z.string().min(1).max(2000),
    back: z.string().min(1).max(2000),
  })).min(1).max(50),
});
```

**Schemat Zod nie ma pola `collection_id`.** API nie akceptuje i nie oczekuje kolekcji.

### Serwis — `src/lib/services/flashcards.ts:14-19`

```ts
const rows = cards.map((card) => ({
  user_id: userId,
  front: card.front,
  back: card.back,
  source: card.source,
  generation_id: card.generation_id ?? null,
}));
```

**Brak `collection_id` w mapowaniu.** Serwis wstawia fiszki z domyślnym `null` dla `collection_id`.

### DB — `supabase/migrations/20260605120000:36-37`

```sql
alter table flashcards
  add column collection_id uuid references collections(id) on delete set null;
```

**`collection_id` jest nullable.** DB pozwala na fiszki-orphany.

### Efekt w nauce — `src/lib/services/study.ts:47`

```ts
.eq("flashcards.collection_id", collectionId)
```

**`getDueCards` filtruje po `collection_id`.** Fiszki z `collection_id = null` nie przejdą żadnego filtra — są niewidoczne dla KAŻDEJ sesji nauki.

## 3.2 Ścieżka ręcznego tworzenia

### UI — `src/components/flashcards/CreateFlashcardForm.tsx:21-28`

```ts
body: JSON.stringify({
  source: "manual",
  flashcards: [{ front: front.trim(), back: back.trim() }],
}),
```

**Identyczny problem — brak `collection_id`.** Ręcznie tworzone fiszki również są orphanami.

## 3.3 Jedyne "ratowanie" — ręczne przypisanie

### UI — `src/components/flashcards/FlashcardListItem.tsx:105-121`

```ts
async function handleCollectionChange(collectionId: string | null) {
  const res = await fetch("/api/flashcards", {
    method: "PATCH",
    body: JSON.stringify({ id: flashcard.id, collection_id: collectionId }),
  });
}
```

**Użytkownik MOŻE ręcznie przypisać fiszkę do kolekcji** z poziomu listy flashcards. Ale to wymaga:

1. Wyjścia z flow generowania
2. Przejścia na /flashcards
3. Ręcznego przypisania KAŻDEJ fiszki
4. Powrotu na /study

**Klient (UI) jest jedynym "strażnikiem"** — i to strażnikiem opcjonalnym, wymagającym od użytkownika wiedzy, że musi ręcznie przypisać karty, zanim będą studyable.

## 3.4 Podsumowanie diagnozy

| Warstwa              | Plik:linia                      | Status                                               |
| -------------------- | ------------------------------- | ---------------------------------------------------- |
| UI (generowanie)     | `FlashcardReview.tsx:54-59`     | **Nie egzekwuje** — brak collection pickera          |
| UI (manualne)        | `CreateFlashcardForm.tsx:21-28` | **Nie egzekwuje** — brak collection pickera          |
| UI (edycja)          | `FlashcardListItem.tsx:105-121` | **Opcjonalne** — jedyny punkt, wymagający inicjatywy |
| API schema           | `flashcards.ts:7-27`            | **Nie egzekwuje** — brak pola `collection_id`        |
| Serwis create        | `flashcards.ts:14-19`           | **Nie egzekwuje** — wstawia `null`                   |
| Serwis getDueCards   | `study.ts:47`                   | **Cicho wyklucza** — inner join filtruje orphanów    |
| Serwis processReview | `study.ts:99-183`               | **Nie dotyczy** — review dotyczy istniejącego stanu  |
| DB schema            | `20260605120000:36-37`          | **Pozwala** — nullable FK                            |
| DB trigger           | `20260605120000:115-127`        | **Nie dotyczy** — tworzy SR state, nie kolekcję      |

**Tryb awarii:** CICHY. Użytkownik generuje fiszki, widzi "X flashcards saved!", wraca do /study i widzi 0 kart due. Brak komunikatu błędu, brak ostrzeżenia. Fiszki "istnieją" ale są martwe.

---

# KROK 4 — Projekt agregatu-strażnika

## 4.1 Agregat: `StudyableFlashcard`

### Granica agregatu

`StudyableFlashcard` łączy treść fiszki (front/back), jej przynależność kolekcyjną i stan SR w jedną spójną jednostkę. Niezmiennik jest egzekwowany na wejściu — nie da się stworzyć fiszki bez kolekcji.

```
┌──────────────────────────────────────────────────────┐
│ StudyableFlashcard (Aggregate Root)                   │
│──────────────────────────────────────────────────────│
│  id: UUID                                             │
│  userId: UUID                                         │
│  collectionId: UUID        ← ALWAYS non-null          │
│  generationId: UUID | null                            │
│  front: string             ← 1-2000 chars, non-empty  │
│  back: string              ← 1-2000 chars, non-empty  │
│  source: "ai" | "manual"                              │
│  srState: SRState          ← ALWAYS present            │
│  createdAt: Date                                      │
│  updatedAt: Date                                      │
│                                                       │
│  ▸ Invariants:                                        │
│    1. collectionId is never null                       │
│    2. srState is always present                        │
│    3. front/back are non-empty, 1-2000 chars           │
│    4. source=ai → generationId required                │
└──────────────────────────────────────────────────────┘
```

### 4.2 Fabryka — `createStudyableFlashcards`

```ts
// src/lib/domain/studyable-flashcard.ts

export class EmptyContentError extends Error {
  readonly field: "front" | "back";
  constructor(field: "front" | "back") {
    super(`Flashcard ${field} cannot be empty`);
    this.name = "EmptyContentError";
    this.field = field;
  }
}

export class ContentTooLongError extends Error {
  readonly field: "front" | "back";
  readonly length: number;
  constructor(field: "front" | "back", length: number) {
    super(`Flashcard ${field} exceeds 2000 characters (${length})`);
    this.name = "ContentTooLongError";
    this.field = field;
    this.length = length;
  }
}

export class MissingCollectionError extends Error {
  constructor() {
    super("Flashcard must belong to a collection to be studyable");
    this.name = "MissingCollectionError";
  }
}

export class InvalidSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSourceError";
  }
}

interface CreateFlashcardParams {
  userId: string;
  collectionId: string; // ← WYMAGANY, nie opcjonalny
  front: string;
  back: string;
  source: "ai" | "manual";
  generationId?: string;
}

interface StudyableFlashcard {
  id: string;
  userId: string;
  collectionId: string; // ← nigdy null
  generationId: string | null;
  front: string;
  back: string;
  source: "ai" | "manual";
  srState: DefaultSRState;
}

function createStudyableFlashcard(params: CreateFlashcardParams): StudyableFlashcard {
  // Precondition: content
  const front = params.front.trim();
  const back = params.back.trim();
  if (front.length === 0) throw new EmptyContentError("front");
  if (back.length === 0) throw new EmptyContentError("back");
  if (front.length > 2000) throw new ContentTooLongError("front", front.length);
  if (back.length > 2000) throw new ContentTooLongError("back", back.length);

  // Precondition: collection
  if (!params.collectionId) throw new MissingCollectionError();

  // Precondition: source ↔ generation_id consistency
  if (params.source === "ai" && !params.generationId) {
    throw new InvalidSourceError("AI flashcard requires generation_id");
  }
  if (params.source === "manual" && params.generationId) {
    throw new InvalidSourceError("Manual flashcard must not have generation_id");
  }

  return {
    id: crypto.randomUUID(),
    userId: params.userId,
    collectionId: params.collectionId,
    generationId: params.generationId ?? null,
    front,
    back,
    source: params.source,
    srState: defaultSRState(),
  };
}

function defaultSRState(): DefaultSRState {
  return {
    difficulty: 0,
    due: new Date(),
    elapsedDays: 0,
    lapses: 0,
    lastReview: null,
    learningSteps: 0,
    reps: 0,
    scheduledDays: 0,
    stability: 0,
    state: 0, // New card
  };
}
```

**Nielegalna operacja rzuca nazwany błąd domenowy — nigdy nie "cicho aktualizuje stanu".**

### 4.3 Metoda domenowa — `reassignCollection`

```ts
function reassignCollection(card: StudyableFlashcard, newCollectionId: string): StudyableFlashcard {
  if (!newCollectionId) throw new MissingCollectionError();
  return { ...card, collectionId: newCollectionId };
}
```

`collection_id = null` nie jest dozwolone. Przeniesienie karty wymaga podania docelowej kolekcji. Jeśli użytkownik chce "usunąć z kolekcji" — musi przenieść do innej.

### 4.4 Repozytorium

```ts
// src/lib/domain/studyable-flashcard-repository.ts

interface StudyableFlashcardRepository {
  /**
   * Zapisuje fiszki kompletnie — flashcard row + SR state + collection assignment
   * w JEDNEJ transakcji. Zastępuje rozdzielone createFlashcards + DB trigger.
   */
  saveMany(cards: StudyableFlashcard[]): Promise<void>;

  /**
   * Ładuje kompletny agregat (content + SR state + collection)
   * dla kart due w danej kolekcji.
   */
  findDueByCollection(userId: string, collectionId: string): Promise<StudyableFlashcard[]>;

  /**
   * Atomowy review: update SR state + insert log w jednej transakcji.
   * Korzysta z istniejącego RPC process_review.
   */
  saveReview(
    flashcardId: string,
    userId: string,
    updatedSRState: SRStateUpdate,
    reviewLog: ReviewLogEntry,
  ): Promise<void>;
}
```

**Implementacja `saveMany`:** Zamiast polegać na triggerze DB, repozytorium jawnie wstawia zarówno `flashcards` jak i `flashcard_sr_state` w jednym RPC/transakcji. To czyni niezmiennik widocznym w kodzie aplikacji, nie ukrytym w triggerze.

### 4.5 Cienkie API route

```ts
// src/pages/api/flashcards.ts POST — AFTER refactor

export const SaveFlashcardsSchema = z
  .object({
    collection_id: z.uuid("collection_id is required"), // ← NOWY, WYMAGANY
    generation_id: z.uuid().optional(),
    source: z.enum(["ai", "manual"]).default("ai"),
    flashcards: z
      .array(
        z.object({
          front: z.string().min(1).max(2000),
          back: z.string().min(1).max(2000),
        }),
      )
      .min(1)
      .max(50),
  })
  .refine(/* source↔generation_id */);

export const POST: APIRoute = async (context) => {
  // ... auth check ...
  // ... Zod parse ...

  try {
    const cards = validation.data.flashcards.map((f) =>
      createStudyableFlashcard({
        userId: context.locals.user.id,
        collectionId: validation.data.collection_id, // ← nigdy null
        front: f.front,
        back: f.back,
        source: validation.data.source,
        generationId: validation.data.generation_id,
      }),
    );

    await repository.saveMany(cards);

    return new Response(JSON.stringify({ saved_count: cards.length }), {
      status: 201,
    });
  } catch (err) {
    // Mapowanie błędu domenowego → HTTP
    if (err instanceof MissingCollectionError) return json(400, err.message);
    if (err instanceof EmptyContentError) return json(400, err.message);
    if (err instanceof ContentTooLongError) return json(400, err.message);
    if (err instanceof InvalidSourceError) return json(400, err.message);
    throw err;
  }
};
```

**Egzekucja przenosi się z klienta na serwer.** Dziś klient jest jedynym (opcjonalnym) strażnikiem. Po refaktorze: brak `collection_id` → 400 Bad Request, nigdy cichy null.

### 4.6 Zmiany w UI

#### GenerateView → FlashcardReview

Dodać collection picker w toolbarze review. Użytkownik wybiera kolekcję PRZED zapisem. Jeśli nie ma kolekcji — przycisk "Create collection" inline.

```
┌──────────────────────────────────────────────────────────┐
│  3 of 5 accepted                                         │
│                                                          │
│  Save to: [ My Study Deck ▾ ]   [ Accept all ] [ Save ] │
└──────────────────────────────────────────────────────────┘
```

#### CreateFlashcardForm

Dodać dropdown kolekcji w formularzu. Wymagany (nie "No collection").

#### FlashcardListItem

Collection dropdown: opcja "No collection" jest **usunięta**. Użytkownik może przenosić między kolekcjami, nie usuwać przypisania.

### 4.7 Migracja DB

```sql
-- 1. Create default collection for users who have orphaned flashcards
INSERT INTO collections (user_id, name)
SELECT DISTINCT user_id, 'My Flashcards'
FROM flashcards
WHERE collection_id IS NULL
ON CONFLICT DO NOTHING;

-- 2. Assign orphaned flashcards to the user's default collection
UPDATE flashcards f
SET collection_id = (
  SELECT id FROM collections c
  WHERE c.user_id = f.user_id AND c.name = 'My Flashcards'
  LIMIT 1
)
WHERE f.collection_id IS NULL;

-- 3. Make collection_id NOT NULL
ALTER TABLE flashcards
  ALTER COLUMN collection_id SET NOT NULL;
```

---

# KROK 5 — Before/After, plan, testy

## 5.1 Before/After

### Miejsce 1: Tworzenie fiszek z AI

| Before                                                   | After                                                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `FlashcardReview.tsx:54-59`: payload bez `collection_id` | Payload zawiera `collection_id` z collection pickera                                      |
| `flashcards.ts:7-27`: Zod schema bez `collection_id`     | Schema wymaga `collection_id: z.uuid()`                                                   |
| `flashcards.ts:14-19`: serwis wstawia bez kolekcji       | Fabryka `createStudyableFlashcard` wymaga `collectionId` — rzuca `MissingCollectionError` |
| Fiszka zapisana, ale nieosiągalna dla nauki              | Fiszka zapisana I natychmiast studyable                                                   |

### Miejsce 2: Ręczne tworzenie fiszki

| Before                                                       | After                                       |
| ------------------------------------------------------------ | ------------------------------------------- |
| `CreateFlashcardForm.tsx:21-28`: payload bez `collection_id` | Payload zawiera `collection_id` z dropdownu |
| Fiszka orphan                                                | Fiszka w kolekcji                           |

### Miejsce 3: Edycja przypisania kolekcji

| Before                                                              | After                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `FlashcardListItem.tsx:191-200`: dropdown ma opcję "No collection"  | Dropdown nie ma opcji "No collection" — tylko wybór między kolekcjami     |
| `flashcards.ts:40`: `collection_id: z.uuid().nullable().optional()` | `collection_id: z.uuid().optional()` (opcjonalny w PATCH, ale nigdy null) |
| Użytkownik może "odpiąć" fiszkę od kolekcji, czyniąc ją orphanem    | Przeniesienie wymaga wybrania docelowej kolekcji                          |

### Miejsce 4: Sesja nauki

| Before                                                                         | After                                                                  |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `study.ts:47`: `getDueCards` filtruje po `collection_id` — orphany niewidoczne | Bez zmian w logice, ale nie ma orphanów — każda fiszka jest w kolekcji |
| Cicha utrata fiszek                                                            | Gwarancja kompletności                                                 |

### Miejsce 5: DB

| Before                                                       | After                                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `20260605120000:36-37`: `collection_id uuid ... nullable`    | `ALTER COLUMN collection_id SET NOT NULL`                                                          |
| Trigger `flashcards_create_sr_state`: jedyne źródło SR state | Repozytorium jawnie wstawia SR state + flashcard w jednej transakcji (trigger opcjonalny/usunięty) |

## 5.2 Plan faz refaktoru

### Faza 1: Warstwa domenowa (test-first)

1. Stworzyć `src/lib/domain/studyable-flashcard.ts` z fabryką i błędami domenowymi
2. Stworzyć `src/lib/domain/studyable-flashcard.test.ts` z testami niezmiennika

**Testy tej fazy — patrz sekcja 5.3.**

### Faza 2: Repozytorium

1. Stworzyć `src/lib/domain/studyable-flashcard-repository.ts`
2. Napisać RPC `save_flashcards_batch` (flashcards + sr_state w jednej transakcji)
3. Przetestować integracyjnie (lub przez istniejące testy serwisowe)

### Faza 3: Migracja danych

1. Migracja SQL: backfill orphanów → default collection
2. Migracja SQL: `ALTER COLUMN collection_id SET NOT NULL`
3. Opcjonalnie: usunąć trigger `flashcards_create_sr_state` (repozytorium przejmuje odpowiedzialność)

### Faza 4: API

1. Zaktualizować `SaveFlashcardsSchema` — wymagać `collection_id`
2. Zaktualizować `UpdateFlashcardSchema` — `collection_id` nie nullable
3. Zaktualizować handler POST: używać fabryki + repozytorium
4. Zaktualizować handler PATCH: nie akceptować `null` dla `collection_id`
5. Zaktualizować istniejące testy API

### Faza 5: UI

1. Dodać collection picker do `FlashcardReview.tsx`
2. Dodać collection dropdown do `CreateFlashcardForm.tsx`
3. Usunąć opcję "No collection" z `FlashcardListItem.tsx`
4. Załadować kolekcje w `GenerateView.tsx` (fetch `/api/collections`)

### Faza 6: Cleanup

1. Usunąć stary serwis `createFlashcards` (zastąpiony przez repozytorium)
2. Zaktualizować typy w `src/types.ts`: `collection_id: string` (nie `string | null`)
3. Usunąć trigger DB (jeśli repozytorium przejęło odpowiedzialność)

## 5.3 Przypadki testowe (faza 1 — test-first)

### Legalne przejścia (happy paths)

| Test                               | Input                                                                                 | Expected                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Tworzenie AI fiszki z kolekcją     | `{ front: "Q", back: "A", source: "ai", generationId: "uuid", collectionId: "uuid" }` | Zwraca `StudyableFlashcard` z `srState` i `collectionId` |
| Tworzenie manual fiszki z kolekcją | `{ front: "Q", back: "A", source: "manual", collectionId: "uuid" }`                   | Zwraca `StudyableFlashcard` bez `generationId`           |
| Front/back na granicy 2000 znaków  | `{ front: "a".repeat(2000), back: "b", ... }`                                         | Sukces                                                   |
| Batch tworzenie wielu fiszek       | 50 poprawnych fiszek                                                                  | 50 `StudyableFlashcard` z SR state                       |

### Nielegalne przejścia (powinny rzucić błąd)

| Test                           | Input                                        | Expected error                       |
| ------------------------------ | -------------------------------------------- | ------------------------------------ |
| Brak `collectionId`            | `{ ..., collectionId: undefined }`           | `MissingCollectionError`             |
| Pusty `collectionId`           | `{ ..., collectionId: "" }`                  | `MissingCollectionError`             |
| Pusty `front`                  | `{ front: "", ... }`                         | `EmptyContentError("front")`         |
| Pusty `back` (same whitespace) | `{ back: "   ", ... }`                       | `EmptyContentError("back")`          |
| `front` > 2000 znaków          | `{ front: "a".repeat(2001), ... }`           | `ContentTooLongError("front", 2001)` |
| AI bez `generationId`          | `{ source: "ai", generationId: undefined }`  | `InvalidSourceError`                 |
| Manual z `generationId`        | `{ source: "manual", generationId: "uuid" }` | `InvalidSourceError`                 |
| `reassignCollection` z `null`  | `reassignCollection(card, null)`             | `MissingCollectionError`             |
| `reassignCollection` z `""`    | `reassignCollection(card, "")`               | `MissingCollectionError`             |

## 5.4 Nowe "load-bearing" nazwy

| Nazwa                          | Rodzaj              | Lokalizacja                                        |
| ------------------------------ | ------------------- | -------------------------------------------------- |
| `StudyableFlashcard`           | Interface (agregat) | `src/lib/domain/studyable-flashcard.ts`            |
| `createStudyableFlashcard`     | Factory function    | `src/lib/domain/studyable-flashcard.ts`            |
| `reassignCollection`           | Domain method       | `src/lib/domain/studyable-flashcard.ts`            |
| `MissingCollectionError`       | Domain error        | `src/lib/domain/studyable-flashcard.ts`            |
| `EmptyContentError`            | Domain error        | `src/lib/domain/studyable-flashcard.ts`            |
| `ContentTooLongError`          | Domain error        | `src/lib/domain/studyable-flashcard.ts`            |
| `InvalidSourceError`           | Domain error        | `src/lib/domain/studyable-flashcard.ts`            |
| `StudyableFlashcardRepository` | Interface (port)    | `src/lib/domain/studyable-flashcard-repository.ts` |
| `save_flashcards_batch`        | PostgreSQL RPC      | migracja SQL                                       |

---

# Podsumowanie

FlipIt ma krytyczny niezmiennik domenowy, który jest **aktywnie naruszany**: fiszki tworzone przez główny flow (AI generation → save) powstają bez przypisania do kolekcji, przez co są niewidoczne dla systemu spaced repetition. Narusza to guardrail PRD _"Study progress is never lost"_ i przerywa north-star pętlę produktu (paste → generate → study). Dziś jedynym "strażnikiem" jest opcjonalny, manualny dropdown kolekcji na stronie /flashcards, wymagający od użytkownika wiedzy o problemie. Zaprojektowany agregat `StudyableFlashcard` wymusza niezmiennik w fabryce — `collectionId` jest wymagany, brak rzuca `MissingCollectionError`, a repozytorium zapisuje fiszkę + SR state + kolekcję atomowo. Refaktor jest podzielony na 6 faz: domena (test-first) → repozytorium → migracja danych → API → UI → cleanup. Migracja backfilluje istniejące orphany do domyślnej kolekcji "My Flashcards" i zmienia `collection_id` na NOT NULL.
