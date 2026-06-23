---
title: FlipIt — Domain Distillation
created: 2026-06-20
type: domain-distillation
sources:
  - context/foundation/prd.md
  - context/foundation/shape-notes.md
  - context/foundation/roadmap.md
  - context/foundation/tech-stack.md
  - src/types.ts
  - supabase/migrations/*.sql
  - src/lib/services/*.ts
  - src/pages/api/**/*.ts
---

# KROK 0 — Kontekst projektu

## Wizja

FlipIt to aplikacja webowa do nauki metodą spaced repetition, której kluczowym wyróżnikiem jest generowanie fiszek przez LLM. Problem: tworzenie fiszek jest zbyt czasochłonne, co zniechęca profesjonalistów do stosowania SR. Rozwiązanie: wklej tekst → AI generuje fiszki → przejrzyj/edytuj → zapisz → ucz się z algorytmem SR.

**Źródło:** `context/foundation/prd.md:20-22`

## Stack i struktura

| Warstwa                    | Technologia                                          | Katalogi                                   |
| -------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| UI / Strony                | Astro 6 SSR + React 19 islands                       | `src/pages/`, `src/components/`            |
| API                        | Astro API routes (Cloudflare workerd)                | `src/pages/api/`                           |
| Serwisy / logika biznesowa | TypeScript                                           | `src/lib/services/`                        |
| Persystencja               | Supabase PostgreSQL + RLS                            | `supabase/migrations/`                     |
| Auth                       | Supabase Auth (cookie-based SSR)                     | `src/lib/supabase.ts`, `src/middleware.ts` |
| AI                         | OpenRouter API (domyślnie `google/gemini-3.5-flash`) | `src/lib/services/openrouter.ts`           |
| SR                         | Biblioteka `ts-fsrs`                                 | `src/lib/services/study.ts`                |

---

# KROK 1 — Ubiquitous Language

## 1.1 Flashcard (Fiszka)

**Definicja:** Dwustronna karta do nauki — `front` (pytanie/prompt) i `back` (odpowiedź). Każda fiszka izoluje jeden koncept. Posiada atrybut `source` (`ai` | `manual`) wskazujący pochodzenie.

- **Źródło PRD:** `prd.md:103-106` — "Each card isolates one concept — no multi-part questions, no compound answers."
- **W kodzie:**
  - Typ: `src/types.ts:1-11` (`Flashcard` interface)
  - Tabela: `supabase/migrations/20260602120000_create_flashcards.sql:1-10`
  - Serwis CRUD: `src/lib/services/flashcards.ts:1-109`
  - API: `src/pages/api/flashcards.ts`
- **Pola:** `id`, `user_id`, `generation_id` (nullable), `collection_id` (nullable), `front`, `back`, `source`, `created_at`, `updated_at`

## 1.2 FlashcardProposal (Propozycja fiszki)

**Definicja:** Tymczasowa fiszka wygenerowana przez AI, jeszcze niezapisana — czeka na decyzję użytkownika (accept / edit / reject).

- **Źródło PRD:** `prd.md:74` — "User can review AI-generated flashcards — accept, edit, or reject each one"
- **W kodzie:**
  - Typ: `src/types.ts:13-16` (`FlashcardProposal` z polami `front`, `back`)
  - Generowanie: `src/lib/services/openrouter.ts:58-105` (parsowanie odpowiedzi LLM)
  - UI przeglądu: `src/components/generate/FlashcardReview.tsx`

## 1.3 Generation (Sesja generowania)

**Definicja:** Pojedyncze wywołanie AI z tekstem źródłowym, które produkuje zbiór propozycji fiszek. Identyfikowane przez `generation_id`.

- **Źródło PRD:** `prd.md:72-73` (FR-003) — "User can paste source text and trigger AI flashcard generation."
- **W kodzie:**
  - Endpoint: `src/pages/api/generations.ts:14-59`
  - `generation_id` generowany jako UUID po stronie serwera: `generations.ts:45`
  - FK w tabeli flashcards: `20260602120000_create_flashcards.sql:3` (`generation_id uuid`)
  - **Uwaga:** Brak dedykowanej tabeli `generations` — `generation_id` jest generowany ad-hoc i przekazywany klientowi, ale nigdzie nie persystowany jako samodzielna encja.

## 1.4 Source Text (Tekst źródłowy)

**Definicja:** Surowy tekst wklejony przez użytkownika (artykuły, dokumentacja, notatki), z którego AI generuje fiszki.

- **Źródło PRD:** `prd.md:104` — "a single input: raw text pasted by the user"
- **W kodzie:**
  - Walidacja Zod: `src/pages/api/generations.ts:6-9` — `source_text` 1–10 000 znaków
  - Przekazywany do LLM, nie jest przechowywany (zgodnie z NFR: `prd.md:100`)

## 1.5 Collection (Kolekcja)

**Definicja:** Nazwany zbiór fiszek należący do użytkownika. Kontekst organizacyjny dla kart i sesji nauki.

- **Źródło PRD:** PRD mówi o "collection" w kontekście ogólnym (`prd.md:59` — "Accepted cards appear in the user's collection"), ale **nie definiuje Collection jako odrębnej encji** z nazwą i CRUD. Kolekcje jako byt pojawiły się w roadmapie S-04.
- **W kodzie:**
  - Typ: `src/types.ts:33-39` (`Collection`), `src/types.ts:41-44` (`CollectionWithCounts`)
  - Tabela: `supabase/migrations/20260605120000_create_collections_and_sr_tables.sql:1-8`
  - Serwis: `src/lib/services/collections.ts:1-77`
  - API: `src/pages/api/collections.ts`

## 1.6 Spaced Repetition State (Stan SR)

**Definicja:** Parametry algorytmu FSRS dla danej fiszki: difficulty, stability, due date, lapses, reps, state. Relacja 1:1 z Flashcard. Tworzony automatycznie triggerem przy insercie fiszki.

- **Źródło PRD:** `prd.md:90-91` (FR-009, FR-010) — "spaced repetition scheduling"; "rate their recall"
- **W kodzie:**
  - Typ: `src/types.ts:46-61` (`FlashcardSRState`)
  - Tabela: `20260605120000_create_collections_and_sr_tables.sql:42-57`
  - Auto-create trigger: `20260605120000_create_collections_and_sr_tables.sql:115-127`
  - Bootstrap migracja: `20260605120001_bootstrap_sr_state.sql:1-5`

## 1.7 Study Session (Sesja nauki)

**Definicja:** Interaktywna sesja, w której użytkownik przegląda fiszki z danej kolekcji, które są "due" (termin powtórki minął). Dla każdej karty: odkryj → oceń → następna.

- **Źródło PRD:** `prd.md:90` (FR-009) — "User can start a study session using spaced repetition scheduling."
- **W kodzie:**
  - Sesja **nie jest encją persystowaną** — jest ephemeralnym stanem UI
  - Pobieranie kart due: `src/lib/services/study.ts:36-72` (`getDueCards`)
  - Komponent: `src/components/study/StudySessionView.tsx`
  - API: `src/pages/api/study/[id].ts` (id = collectionId)
  - **Sesja jest zawsze scopowana do kolekcji** (wymagany `collectionId`)

## 1.8 Review (Ocena powtórki)

**Definicja:** Pojedyncza ocena wystawiona przez użytkownika podczas sesji nauki. Rating 1-4 (Again, Hard, Good, Easy — skala FSRS). Atomowa operacja: aktualizacja stanu SR + zapis logu.

- **Źródło PRD:** `prd.md:93` (FR-010) — "User can rate their recall during study to feed the SR algorithm."
- **W kodzie:**
  - Typ logu: `src/types.ts:63-78` (`ReviewLog`)
  - Walidacja: `src/pages/api/study/review.ts:7-9` — `rating: z.number().int().min(1).max(4)`
  - Logika SR: `src/lib/services/study.ts:99-183` (`processReview` — wywołuje `ts-fsrs`)
  - Atomowy RPC: `supabase/migrations/20260605180000_add_process_review_rpc.sql` (`process_review`)

## 1.9 Rating (Ocena)

**Definicja:** Samoocena przypomnienia sobie odpowiedzi: Again (1), Hard (2), Good (3), Easy (4). Mapowanie na skala FSRS.

- **Źródło PRD:** `prd.md:93` — "rate their recall"
- **W kodzie:**
  - Enum: `ts-fsrs` `Rating` (importowany w `StudySessionView.tsx:2`)
  - Podgląd interwałów: `src/types.ts:96-99` (`IntervalPreview`)

## 1.10 StudyCard (Karta do nauki)

**Definicja:** Widok łączący treść fiszki (front/back) z jej stanem SR. Używany wyłącznie podczas sesji nauki.

- **Źródło PRD:** BRAK bezpośredniego odpowiednika — wynik złączenia Flashcard + SR State
- **W kodzie:** `src/types.ts:80-94` (`StudyCard`)

## 1.11 Due Date / Due Cards (Termin powtórki)

**Definicja:** Timestamp wyznaczający, kiedy fiszka powinna być następnie powtórzona. Karty z `due <= now()` są "due" i trafiają do sesji nauki.

- **Źródło PRD:** implikowane przez FR-009 ("spaced repetition scheduling")
- **W kodzie:**
  - Filtr: `src/lib/services/study.ts:48` — `.lte("due", new Date().toISOString())`
  - Pole: `flashcard_sr_state.due` (`20260605120000_create_collections_and_sr_tables.sql:47`)

## 1.12 User (Użytkownik)

**Definicja:** Osoba z kontem w systemie. Flat model — wszyscy mają te same uprawnienia. Każdy widzi tylko swoje dane.

- **Źródło PRD:** `prd.md:110-111` — "Flat user model — all users have the same capabilities."
- **W kodzie:**
  - Supabase `auth.users` (zarządzane przez Supabase Auth)
  - Middleware: `src/middleware.ts:6-25` — `context.locals.user`
  - RLS na każdej tabeli: `user_id = auth.uid()`

---

# KROK 2 — Klasyfikacja subdomen

| Subdomena                   | Kategoria      | Pojęcia                                                      | Uzasadnienie                                                                                                                                                            |
| --------------------------- | -------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI Flashcard Generation** | **CORE**       | Generation, Source Text, FlashcardProposal, Source (ai)      | "paste-and-generate is the core value proposition" (`prd.md:73`). Wyróżnik produktu — to, co odróżnia FlipIt od Anki. Success criterion: 75% fiszek z AI (`prd.md:36`). |
| **Spaced Repetition Study** | **CORE**       | Study Session, Review, Rating, SR State, Due Date, StudyCard | "SR is core to the product identity" (`prd.md:91`). Zamyka pętlę wartości: generuj → ucz się. North star roadmapy (`roadmap.md:24`).                                    |
| **Flashcard Management**    | **SUPPORTING** | Flashcard (CRUD), Collection                                 | CRUD to "safety net" (`prd.md:80`), nie wyróżnik. Kolekcje dodane post-PRD jako organizator. Wspiera Core, ale sam w sobie nie stanowi przewagi.                        |
| **Authentication & Access** | **GENERIC**    | User, Login/Logout, Session cookies                          | "No counter-argument; auth is necessary" (`prd.md:66`). Standardowy problem rozwiązany przez Supabase Auth. Zero logiki domenowej.                                      |

---

# KROK 3 — Kandydaci na agregaty i ich niezmienniki

## A1: Flashcard (Agregat główny)

**Granica:** Flashcard + FlashcardSRState (relacja 1:1, silnie sprzężone — SR State nie ma sensu bez fiszki)

| Niezmiennik                                                           | Źródło                                                                                                | Status w kodzie                                                                                                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `front` i `back` muszą być niepuste i <= 2000 znaków                  | `prd.md:104` ("clear question, concise answer"); `generations.ts:8-9`; `flashcards.ts:15-16` (schema) | **Egzekwowany** — Zod walidacja w API (`flashcards.ts:15-16`), LLM parser odrzuca puste/za długie (`openrouter.ts:93`), DB constraint `not null` |
| Każda fiszka izoluje jeden koncept                                    | `prd.md:104` — "one concept per card"                                                                 | **Deklarowany** — w prompcie LLM (`openrouter.ts:10`), ale brak egzekucji dla kart manualnych                                                    |
| `source` to `ai` lub `manual`                                         | `prd.md:56, 79` (AI vs manual); `20260602120000_create_flashcards.sql:7`                              | **Egzekwowany** — DB CHECK constraint + Zod enum                                                                                                 |
| Jeśli `source = ai`, to `generation_id` musi być podany (i odwrotnie) | implikowane przez flow: generowanie linkuje karty do sesji AI                                         | **Egzekwowany** — Zod refine w `flashcards.ts:22-27`                                                                                             |
| Każda fiszka **musi** mieć SR State                                   | `prd.md:44` (guardrail: "Study progress is never lost")                                               | **Egzekwowany** — trigger DB: `flashcards_create_sr_state` (`20260605120000:115-127`)                                                            |
| Fiszka należy do dokładnie jednego użytkownika                        | `prd.md:111` — "Each user sees only their own data"                                                   | **Egzekwowany** — `user_id NOT NULL` + RLS                                                                                                       |

## A2: Collection (Agregat)

**Granica:** Collection (bez fiszek — fiszki mają FK do kolekcji, ale kolekcja nie "posiada" ich w sensie agregatowym)

| Niezmiennik                              | Źródło                          | Status w kodzie                                              |
| ---------------------------------------- | ------------------------------- | ------------------------------------------------------------ |
| `name` musi być niepuste i <= 200 znaków | `collections.ts:8` (API schema) | **Egzekwowany** — Zod walidacja                              |
| Kolekcja należy do jednego użytkownika   | implikowane przez RLS           | **Egzekwowany** — `user_id NOT NULL` + RLS                   |
| Usunięcie kolekcji nie usuwa fiszek      | decyzja architektoniczna        | **Egzekwowany** — `ON DELETE SET NULL` (`20260605120000:37`) |

## A3: Review (Value Object / Event)

**Granica:** Atomowa operacja: nowy ReviewLog + zaktualizowany FlashcardSRState

| Niezmiennik                                              | Źródło                                       | Status w kodzie                                                                               |
| -------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Rating jest liczbą 1-4 (Again, Hard, Good, Easy)         | FSRS protocol + `review.ts:9`                | **Egzekwowany** — Zod `min(1).max(4)`                                                         |
| Review musi atomowo zaktualizować SR State i zapisać log | `prd.md:44` (guardrail: progress never lost) | **Egzekwowany** — PostgreSQL RPC `process_review` w jednej transakcji (`20260605180000:1-73`) |
| Review log jest append-only (brak UPDATE/DELETE)         | decyzja architektoniczna — audit trail       | **Egzekwowany** — brak RLS policy na update/delete dla `review_logs`                          |

---

# KROK 4 — Rozjazdy MODEL vs KOD

| #   | Dokument (PRD) mówi                                                        | Kod robi                                                                                                                                        | Dowód                                                                                                                                                        | Wpływ                                                                                                                                              |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | FR-001: "email + password **or OAuth**"                                    | Tylko email + password (signin, signup). Brak endpointów OAuth.                                                                                 | `src/pages/api/auth/signin.ts`, `signup.ts` — brak OAuth flow; `src/pages/auth/signin.astro`, `signup.astro` — brak przycisków OAuth                         | **Średni** — brak OAuth to brak alternatywnej rejestracji                                                                                          |
| D2  | Guardrail: "75% of AI-generated flashcards accepted" (metryka sukcesu)     | Brak mechanizmu śledzenia accept rate. `generation_id` nie jest persystowany jako encja — nie wiadomo ile kart zaproponowano vs. zaakceptowano. | `src/pages/api/generations.ts:45` — UUID generowany, ale nigdzie nie zapisywany do DB; brak tabeli `generations`                                             | **Wysoki** — krytyczna metryka sukcesu bez danych                                                                                                  |
| D3  | Success criterion: "Users return for a second study session" (retention)   | Brak śledzenia sesji nauki jako encji. Sesja jest efemerycznym stanem UI, nie jest persystowana.                                                | `StudySessionView.tsx` — stan lokalny React; brak tabeli `study_sessions`                                                                                    | **Średni** — nie da się zmierzyć retencji                                                                                                          |
| D4  | PRD opisuje "collection" jako ogólny pojemnik na fiszki użytkownika (l.p.) | Kod implementuje Collection jako nazwaną encję z CRUD. Fiszka może nie mieć kolekcji (`collection_id` nullable).                                | `src/types.ts:33-39`; `20260605120000:36-37` — `collection_id uuid ... ON DELETE SET NULL`                                                                   | **Niski** — rozszerzenie modelu, spójne z roadmapą S-04                                                                                            |
| D5  | FR-009: "start a study session" (bez scopu)                                | Sesja nauki jest **zawsze** scopowana do kolekcji (wymagany `collectionId`).                                                                    | `src/pages/api/study/[id].ts` — `[id]` = collectionId; `src/lib/services/study.ts:38` — `getDueCards(supabase, userId, collectionId)`                        | **Wysoki** — fiszki bez kolekcji (`collection_id = null`) **nie mogą być powtarzane**. Orphan flashcards istnieją w DB ale są nieosiągalne dla SR. |
| D6  | Business Logic: "one concept per card"                                     | Wymuszane tylko w prompcie LLM dla kart AI. Dla kart manualnych brak jakiejkolwiek walidacji "jednego konceptu".                                | `src/lib/services/openrouter.ts:10` — "Create one card per distinct concept"; `src/pages/api/flashcards.ts:35-44` — schema waliduje tylko front/back długość | **Niski** — reguła jakościowa, nie transakcyjna; sensowne że brak programistycznej egzekucji                                                       |
| D7  | NFR: "Continuous visible feedback during AI generation > 2s"               | UI pokazuje spinner, ale brak streamingu LLM. Cała odpowiedź czekana naraz.                                                                     | `src/components/generate/GenerateView.tsx:70-74` — statyczny spinner; `src/lib/services/openrouter.ts:25-39` — standardowy fetch, nie SSE/streaming          | **Niski** — spinner jest, ale UX mógłby być lepszy ze streamingiem                                                                                 |

---

# KROK 5 — Ranking refaktoru

| Prio   | Agregat / Obszar                 | Rdzeniowy niezmiennik                                                            | Ryzyko                                                                                                        | Uzasadnienie                                                                                                                                                                                 |
| ------ | -------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#1** | **Orphan Flashcards** (D5)       | Fiszka **musi** być osiągalna dla sesji nauki (nie może być "martwa" w systemie) | **KRYTYCZNE** — fiszki bez kolekcji istnieją, ale nie mogą być powtarzane; użytkownik traci je bez komunikatu | Narusza guardrail "study progress is never lost". Rozwiązanie: albo wymusić `collection_id NOT NULL` (z default collection), albo obsłużyć `null` w `getDueCards` (np. "all cards" session). |
| **#2** | **Generation jako encja** (D2)   | Sesja generowania powinna być persystowana, aby mierzyć accept rate              | **WYSOKIE** — bez tego nie da się zmierzyć primary success criterion (75% acceptance)                         | Potrzebna tabela `generations` z `source_text_length`, `proposed_count`, `accepted_count`. FK `generation_id` w flashcards już istnieje, ale wskazuje w próżnię.                             |
| **#3** | **OAuth** (D1)                   | FR-001 deklaruje OAuth jako must-have                                            | **ŚREDNIE** — brak alternatywnej rejestracji, ale email+password działa                                       | Supabase Auth wspiera OAuth out of the box; kwestia konfiguracji i przycisków UI.                                                                                                            |
| **#4** | **Study Session tracking** (D3)  | Sesje nauki powinny być encją do pomiaru retencji                                | **ŚREDNIE** — secondary success criterion wymaga danych o powracających użytkownikach                         | Prosta tabela `study_sessions` z `started_at`, `completed_at`, `cards_reviewed`.                                                                                                             |
| **#5** | **Streaming AI generation** (D7) | Feedback musi być ciągły > 2s                                                    | **NISKIE** — spinner istnieje, streaming to enhancement                                                       | OpenRouter wspiera SSE; wymaga refaktoru fetch → stream + progresywne renderowanie kart.                                                                                                     |

---

# Podsumowanie

Artefakt zawiera pełną mapę domeny FlipIt zbudowaną z dokumentów źródłowych (PRD, shape-notes, roadmap) i kodu (migracje SQL, serwisy TypeScript, endpointy API). Zidentyfikowano **12 pojęć domenowych** z cytatami źródłowymi i wskazaniem lokalizacji w kodzie. Domena dzieli się na **2 subdomeny Core** (AI Generation i Spaced Repetition Study), **1 Supporting** (Flashcard/Collection Management) i **1 Generic** (Auth). Wskazano **3 kandydatów na agregaty** (Flashcard+SRState, Collection, Review) z 11 niezmiennikami. Odkryto **7 rozjazdów MODEL vs KOD**, z których najkrytyczniejszy to **orphan flashcards** — fiszki bez kolekcji są nieosiągalne dla sesji nauki, co narusza guardrail PRD "study progress is never lost". Jako drugi priorytet wskazano brak persystencji encji Generation, co uniemożliwia pomiar kluczowej metryki sukcesu (75% acceptance rate). Te dwa rozjazdy powinny być zaadresowane przed kolejnymi iteracjami produktu.
