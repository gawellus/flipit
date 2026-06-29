# Raport analizy MVP — FlipIt

Data analizy: 2026-06-29

## Checklist

### 1. Operacje CRUD ✅

Pełne CRUD dla **flashcards** (główna encja domenowa) — wszystkie operacje utrwalane w Supabase PostgreSQL:

| Operacja   | Endpoint                 | Serwis                                                                               | Dowód                                                       |
| ---------- | ------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Create** | `POST /api/flashcards`   | `createFlashcards()` — `src/lib/services/flashcards.ts:5-30`                         | `.from("flashcards").insert(rows).select()`                 |
| **Read**   | `GET /api/flashcards`    | `listFlashcards()` — `src/lib/services/flashcards.ts:32-69`                          | `.from("flashcards").select()` z paginacją i wyszukiwaniem  |
| **Update** | `PATCH /api/flashcards`  | `updateFlashcard()` — `src/lib/services/flashcards.ts:71-93`                         | `.from("flashcards").update()` — front, back, collection_id |
| **Delete** | `DELETE /api/flashcards` | `deleteFlashcard()` / `deleteFlashcards()` — `src/lib/services/flashcards.ts:95-120` | `.from("flashcards").delete()` (single + bulk)              |

Dodatkowe CRUD dla **collections** (Create, Read, Delete) — `src/pages/api/collections.ts` + `src/lib/services/collections.ts`.

### 2. Logika biznesowa ✅

Projekt zawiera bogatą logikę wykraczającą znacząco poza CRUD:

- **Algorytm FSRS (Free Spaced Repetition Scheduler)** — `src/lib/services/study.ts:99-183` — pełna implementacja powtórek rozłożonych w czasie: obliczanie difficulty, stability, due date, lapses na podstawie oceny użytkownika (1-4).
- **Generowanie fiszek przez LLM** — `src/lib/services/openrouter.ts:20-56` — integracja z OpenRouter API, system prompt, parsowanie i walidacja odpowiedzi JSON z filtrami jakości (`parseFlashcards()` linie 58-105).
- **Podgląd interwałów** — `src/components/study/StudySessionView.tsx:26-48` — obliczanie przyszłych terminów dla każdej z 4 możliwych ocen przed wyborem użytkownika.
- **Agregacja statystyk kolekcji** — `src/lib/services/collections.ts:15-59` — równoległe zapytania + obliczanie due count per kolekcja.
- **Atomowe przetwarzanie recenzji** — PostgreSQL RPC `process_review()` w migracji — UPDATE stanu SR + INSERT logu w jednej transakcji.
- **Maszyna stanów** w `FlashcardReview.tsx` — workflow: pending → accepted/rejected/editing z operacjami batch.

### 3. Testy pokrywające zdefiniowane ryzyka ✅

**Plan testów** istnieje w `context/foundation/test-plan.md` — definiuje 7 scenariuszy awarii z oceną impact/likelihood.

**Mapowanie ryzyk na testy:**

| Ryzyko | Opis                                    | Testy                                                                                                               |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| #1     | LLM zwraca nieparsowalne dane           | `openrouter.test.ts` — parseFlashcards (unit, Vitest)                                                               |
| #4     | CRUD fiszek zawodzi cicho               | `flashcards.test.ts` (unit) + `flashcard-edit-persistence.spec.ts` (E2E, Playwright)                                |
| #5     | Serwer akceptuje niepoprawne dane → 500 | `flashcards.test.ts`, `collections.test.ts`, `generations.test.ts`, `review.test.ts`, `[id].test.ts` — schematy Zod |
| #6     | Licznik due kolekcji jest błędny        | `collection-due-count.spec.ts` (E2E)                                                                                |
| #7     | Chroniona trasa dostępna bez logowania  | `protected-route-redirect.spec.ts` (E2E)                                                                            |

~70+ przypadków testowych unit (Vitest) + 4 scenariusze E2E (Playwright). Faza 1 planu testów ukończona, Faza 2 otwarta.

### 4. Autentykacja powiązana z użytkownikiem ✅

Wielowarstwowe zabezpieczenie:

1. **Supabase Auth** — endpointy signin/signup/signout w `src/pages/api/auth/`
2. **Middleware** (`src/middleware.ts`) — `supabase.auth.getUser()` na każdym żądaniu, redirect dla chronionych tras (`/dashboard`, `/generate`, `/flashcards`, `/study`)
3. **Walidacja API** — każdy endpoint sprawdza `if (!context.locals.user)` → 401
4. **RLS na bazie danych** — 4 tabele z politykami SELECT/INSERT/UPDATE/DELETE filtrowanymi przez `user_id = auth.uid()`
5. **Filtrowanie aplikacyjne** — każde zapytanie serwisowe zawiera `.eq("user_id", userId)` (defense in depth)
6. **Weryfikacja w stored procedure** — `process_review()` sprawdza ownership przed modyfikacją

### 5. Dokumentacja ✅

Pełna dokumentacja w `context/foundation/`:

| Dokument       | Ścieżka                                | Zawartość                                                     |
| -------------- | -------------------------------------- | ------------------------------------------------------------- |
| PRD            | `context/foundation/prd.md`            | Wizja, persona, 10 wymagań funkcjonalnych, kryteria sukcesu   |
| Shape notes    | `context/foundation/shape-notes.md`    | 8 faz discovery, rozstrzygnięte szare strefy                  |
| Roadmap        | `context/foundation/roadmap.md`        | 6 slice'ów (wszystkie done), 4 streamy, backlog, parked items |
| Tech stack     | `context/foundation/tech-stack.md`     | Wybór stosu z uzasadnieniem                                   |
| Infrastruktura | `context/foundation/infrastructure.md` | Porównanie 6 platform, analiza ryzyk, pre-mortem              |
| Plan testów    | `context/foundation/test-plan.md`      | 7 ryzyk, 3-fazowy rollout, wzorce testowe                     |
| README         | `README.md` (root)                     | Getting started, skrypty, struktura, deploy                   |

Cała treść jest merytoryczna — brak placeholderów.

## Status projektu

**5/5 kryteriów spełnionych — 100%**

## Powyżej minimum

FlipIt wyraźnie przekracza próg MVP w kilku wymiarach:

- **Algorytm FSRS** — pełnoprawny scheduler powtórek z naukowym zapleczem, nie prosty timer
- **Integracja z LLM** — generowanie fiszek z tekstu źródłowego z walidacją i filtrowaniem jakości
- **Bezpieczeństwo** — wielowarstwowe (middleware → API guards → RLS → app-level filtering → stored procedure)
- **Strategia testowa** — plan oparty na ryzykach z fazowym rolloutem i mapowaniem risk → test
- **Operacje bulk** — masowe usuwanie/przenoszenie fiszek z walidacją granic
- **Dokumentacja** — pełen cykl 10x: shape-notes → PRD → roadmap → tech-stack → infra → test-plan

Brak luk technicznych do uzupełnienia. Projekt jest gotowy do certyfikacji od strony technicznej.
