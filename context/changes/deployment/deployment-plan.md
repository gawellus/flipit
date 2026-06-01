# Plan wdrożenia FlipIt na Cloudflare Workers

## Kontekst

Aplikacja FlipIt (Astro 6 + React 19, Supabase auth/DB) jest w pełni zscaffoldowana pod Cloudflare Workers (`@astrojs/cloudflare`, `wrangler.jsonc`, `nodejs_compat`). Brak endpointu callback dla potwierdzenia emaila, CI celuje w nieistniejący branch `master`. Plan prowadzi od poprawek kodu, przez konfigurację usług zewnętrznych, po pierwszy deploy i automatyzację CI/CD.

### Co jest gotowe (stan na 2026-05-24)

| Element                        | Status                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| Node.js 22.16.0, npm, nvm, Git | ✅ zainstalowane                                                                       |
| wrangler 4.90.0 (devDep)       | ✅ zainstalowany i **zalogowany**                                                      |
| GitHub CLI (gh) 2.92.0         | ✅ zainstalowany, **niezalogowany**                                                    |
| Supabase CLI 2.98.2 (devDep)   | ✅ zainstalowany                                                                       |
| Konto Cloudflare (Free plan)   | ✅ istnieje                                                                            |
| Projekt Supabase Cloud         | ✅ świeżo utworzony (URL + anon key znane, Site URL i email template niekonfigurowane) |
| Repozytorium GitHub            | ✅ istnieje (brak sekretów Actions)                                                    |

---

## Faza -1: Pozostałe kroki konfiguracji CLI

> Node.js, wrangler (zalogowany), Supabase CLI — gotowe. Pozostaje tylko GitHub CLI.

### -1.1 GitHub CLI (gh) — logowanie

GitHub CLI jest zainstalowany (2.92.0), ale **niezalogowany**. Potrzebny do zarządzania secrets i PR-ami.

- [x] `gh auth login` — wybrać:
  - GitHub.com
  - HTTPS
  - Authenticate with browser (lub token)
- [x] `gh auth status` — potwierdzi logowanie
- **Weryfikacja:** `gh auth status` pokazuje zalogowanego użytkownika i scope `repo, read:org`
- **Edge case (2FA):** jeśli konto ma włączone 2FA, browser flow jest najprostsze. Token flow wymaga Personal Access Token z scope `repo, workflow`
- **Edge case (scope `workflow`):** do modyfikacji plików `.github/workflows/` przez `gh` potrzebny jest scope `workflow`. Jeśli logujesz tokenem, dodaj ten scope
- **Support:** `gh` przechowuje credentiale w systemowym keychain (Windows Credential Manager)

### -1.2 Weryfikacja buildu

- [x] `npm ci && npx astro sync && npm run build`
- **Weryfikacja:** build kończy się sukcesem, `dist/` zawiera pliki ✅
- **Edge case:** jeśli build failuje z `Cannot find module 'astro:env/server'`, `npx astro sync` musi być uruchomiony najpierw

### -1.3 Test lokalny (opcjonalny, ale zalecany przed deployem)

- [x] Utworzyć `.dev.vars` z wartościami Supabase (kopia `.env.example`)
- [x] `npx wrangler dev` — uruchomić na workerd runtime (bliższe produkcji niż `npm run dev`)
- [x] Odwiedzić `http://localhost:8787` — strona się ładuje
- **Edge case (wrangler dev vs astro dev):** `npm run dev` = Vite, NIE workerd. `npx wrangler dev` = workerd runtime, bliższe produkcji. Przed deployem zawsze przetestować na `wrangler dev`
- **Edge case (`.dev.vars` brak):** bez `.dev.vars` Supabase client zwróci `null`, auth nie zadziała

---

## Faza 0: Poprawki kodu (wymagane przed deployem)

### 0.1 Naprawienie brancha CI (`master` -> `main`)

- [x] Zmienić `.github/workflows/ci.yml` linie 5 i 7: `[master]` -> `[main]`
- **Weryfikacja:** po pushu do `main` workflow pojawi się w GitHub Actions

### 0.2 Zmiana nazwy Workera z `10x-astro-starter` na `flipit`

- [x] `wrangler.jsonc` linia 3: `"name": "flipit"`
- [x] `supabase/config.toml` linia 5: `project_id = "flipit"`
- **Weryfikacja:** `npx wrangler whoami` pokaże prawidłowy kontekst; URL po deployu będzie `flipit.<subdomain>.workers.dev`
- **Edge case:** jeśli Worker o starej nazwie istnieje na Cloudflare, trzeba go usunąć ręcznie z dashboardu

### 0.3 Dodanie endpointu auth callback (brakujący)

Supabase Cloud ma domyślnie włączoną weryfikację emaila. Brak callbacka = kliknięcie linku potwierdzającego nigdy nie wymieni tokena.

- [x] Utworzyć `src/pages/auth/callback.astro` wg wzorca z oficjalnej dokumentacji Supabase:

```astro
---
import { createClient } from "@/lib/supabase";
import type { EmailOtpType } from "@supabase/supabase-js";

const supabase = createClient(Astro.request.headers, Astro.cookies);

if (supabase) {
  const token_hash = Astro.url.searchParams.get("token_hash");
  const type = Astro.url.searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return Astro.redirect("/dashboard");
    }
  }
}

return Astro.redirect("/auth/signin");
---
```

- **Weryfikacja:** rejestracja z prawdziwym emailem → kliknięcie linku → redirect na `/dashboard`
- **Edge case:** szablon emaila w Supabase musi generować link do `/auth/callback?token_hash=...&type=email` — domyślny szablon Supabase używa `{{ .SiteURL }}/auth/confirm`, więc trzeba go zmienić (patrz Faza 2.3)
- **Support:** Adapter `createClient` w projekcie przyjmuje `(headers, cookies)` — callback korzysta z `Astro.request.headers` i `Astro.cookies` co pasuje do istniejącej sygnatury

### 0.4 Dodanie `.dev.vars.example`

- [x] Utworzyć `.dev.vars.example` z zawartością:

```
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here
```

- **Weryfikacja:** skopiować do `.dev.vars`, uzupełnić wartości, `npx wrangler dev` uruchamia Supabase client
- **Edge case:** `.dev.vars` jest w `.gitignore` — sprawdzić, że `.dev.vars.example` NIE jest ignorowany

---

## Faza 1: Cloudflare — gotowe, limity do zapamiętania

> ✅ Konto Cloudflare istnieje, wrangler zalogowany.

### 1.1 Workers Free plan — limity i co obserwować

Korzystamy z **darmowego planu Workers Free**.

- **Limity Free plan:**
  - **100 000 requestów / dzień** — wystarczające dla MVP
  - **10 ms CPU time / request** — mierzy TYLKO czas wykonywania kodu JS, nie I/O. Fetch do Supabase, oczekiwanie na odpowiedź API = nie liczy się w CPU. Dla podstawowych stron SSR (render HTML + parsowanie cookies + auth check) 10ms powinno wystarczyć
  - **128 MB RAM / invocation** — identyczne jak w płatnym planie
- **Edge case (Exceeded CPU time limit):** jeśli po deployu zobaczysz błąd `Exceeded CPU time limit` w `wrangler tail`, rozwiązania:
  1. Zoptymalizować rendering (mniej komponentów React, mniej Zod walidacji)
  2. Przenieść ciężkie obliczenia na klienta (`client:load`)
  3. W ostateczności — upgrade do Standard ($5/mies., 30s CPU)

---

## Faza 2: Konfiguracja Supabase Cloud (produkcja)

> ✅ Projekt Supabase Cloud istnieje, URL i anon key znane. Pozostaje konfiguracja auth.

### 2.2 Konfiguracja Site URL

**Uwaga:** ten krok wymaga znajomości URL Workera — jeśli nie jest znany, wrócić tu po pierwszym deployu (Faza 4.5).

- [x] Supabase Dashboard → Authentication → URL Configuration
- [x] Ustawić "Site URL" na `https://flipit.pmorawiak.workers.dev`
- [x] Dodać do "Redirect URLs":
  - `http://localhost:4321` (Astro dev)
  - `http://localhost:8787` (wrangler dev)
  - `https://flipit.pmorawiak.workers.dev` (produkcja)
- **Weryfikacja:** Site URL jest ustawiony i pasuje dokładnie do URL Workera (z `https://`)
- **Edge case:** Supabase wymaga **exact match** URL-i — różnica w trailing slash, http vs https, lub subdomain = błąd `redirect URL mismatch`
- **Support:** `<subdomain>` to subdomena Cloudflare konta — zobaczysz ją po pierwszym deployu

### 2.3 Szablon emaila potwierdzającego

- [x] Supabase Dashboard → Authentication → Email Templates
- [x] Wybrać "Confirm signup"
- [x] Zmienić link potwierdzający na:
  ```
  {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
  ```
- **Weryfikacja:** link w emailu prowadzi do `/auth/callback?token_hash=xxx&type=email`
- **Edge case:** domyślny szablon Supabase używa `/auth/confirm` — jeśli nie zmienisz szablonu, callback nigdy nie zostanie wywołany
- **Support:** `{{ .SiteURL }}` automatycznie resolves do Site URL ustawionego w Fazie 2.2

### 2.4 Zapisanie credentials

- [x] Skopiować **Project URL** → to jest `SUPABASE_URL`
- [x] Skopiować **anon public key** → to jest `SUPABASE_KEY`
- [x] Przechować bezpiecznie (menedżer haseł), NIGDY w git
- **Weryfikacja:** URL zaczyna się od `https://`, klucz od `eyJ...`

---

## Faza 3: GitHub — sekrety

> ✅ Repozytorium GitHub istnieje. Pozostaje dodanie sekretów dla CI.

### 3.1 GitHub Secrets dla CI (build)

- [ ] Repo Settings → Secrets and variables → Actions
- [ ] Dodać `SUPABASE_URL` = Project URL z Supabase
- [ ] Dodać `SUPABASE_KEY` = anon key z Supabase
- **Weryfikacja:** sekrety wyświetlają się jako "Updated" (bez widocznej wartości)
- **Edge case:** build Astro przechodzi nawet bez tych zmiennych (są optional w `astro.config.mjs`), ale auth nie będzie działać runtime bez nich ustawionych w wrangler secrets (Faza 4.1)
- **Support:** `CLOUDFLARE_API_TOKEN` i `CLOUDFLARE_ACCOUNT_ID` **NIE są potrzebne** w GitHub Secrets — deploy odbywa się przez Workers Builds (Faza 5), nie GitHub Actions. W GitHub Secrets potrzebne są tylko te 2 wpisy

---

## Faza 4: Pierwszy ręczny deploy

Cel: zweryfikować konfigurację zanim zautomatyzujemy w CI.

### 4.1 Ustawienie wrangler secrets

- [x] `npx wrangler secret put SUPABASE_URL` → wkleić URL Supabase
- [x] `npx wrangler secret put SUPABASE_KEY` → wkleić anon key
- **Weryfikacja:** każda komenda wypisuje "Successfully set secret..."
- **Edge case:** sekrety są zaszyfrowane at rest, widoczne TYLKO dla runtime Workera — nie można ich odczytać z dashboardu po ustawieniu. Aby zweryfikować wartość, trzeba ustawić ponownie
- **Support:** to są sekrety **runtime** (odczytywane przez `astro:env/server` w trakcie request), nie build-time

### 4.2 Budowanie projektu

- [x] `npx astro sync` (generuje typy `.astro/`)
- [x] `npm run build`
- [x] Sprawdzić, że katalog `dist/` istnieje z bundlem SSR
- **Weryfikacja:** build kończy się bez błędów, `dist/` zawiera pliki
- **Edge case:** jeśli build failuje z type errors, `npx astro sync` musi być uruchomiony przed buildem (CI już to robi)

### 4.3 Deploy na Cloudflare Workers

- [x] `npx wrangler deploy`
- [x] Zanotować URL wypisany w output: `https://flipit.pmorawiak.workers.dev`
- **Weryfikacja:** komenda kończy się sukcesem i wypisuje URL
- **Edge case:** pierwszy deploy tworzy Workera. Jeśli `wrangler.jsonc` wciąż ma starą nazwę, URL będzie `10x-astro-starter...` — naprawić nazwę najpierw (Faza 0.2)

### 4.4 Weryfikacja end-to-end

- [x] Odwiedzić URL Workera w przeglądarce
- [x] Sprawdzić, że strona główna ładuje się (SSR działa)
- [x] Przejść na `/auth/signin` — strona się renderuje
- [x] Przejść na `/dashboard` — redirect na `/auth/signin` (ochrona middleware działa)
- [x] Zarejestrować się prawdziwym emailem:
  1. [x] Formularz wysyła POST do `/api/auth/signup`
  2. [x] Redirect na `/auth/confirm-email`
  3. [x] Email przychodzi z linkiem potwierdzającym
  4. [x] Kliknięcie linku prowadzi do `/auth/callback`
  5. [x] Token jest wymieniony, redirect na `/dashboard`
  6. [x] Dashboard wyświetla email użytkownika
- [x] Wylogować się — redirect na `/`
- [x] Zalogować się ponownie — sukces
- **Edge case (SSR/500 errors):** uruchomić `npx wrangler tail` w osobnym terminalu i odwiedzić stronę — błędy runtime pojawią się w logu
- **Edge case (auth redirect fail):** sprawdzić, że Supabase Site URL (Faza 2.2) pasuje DOKŁADNIE do URL Workera
- **Edge case (cookies nie ustawiane):** Workers domyślnie serwują po HTTPS — cookies z flagą `Secure` działają. Problem może być przy `http://` (lokalnie przez `wrangler dev`)
- **Edge case (SUPABASE_URL not defined):** sekrety nie zostały ustawione (Faza 4.1) lub nazwy nie pasują do deklaracji w `astro:env/server`

### 4.5 Aktualizacja Supabase Site URL (jeśli odłożona z Fazy 2.2)

- [ ] Teraz, gdy znasz faktyczny URL Workera, wrócić do Supabase Dashboard → Auth → URL Configuration
- [ ] Ustawić/potwierdzić Site URL i Redirect URLs
- [ ] Przetestować pełny flow rejestracji jeszcze raz

---

## Faza 5: Automatyczny deploy przez Cloudflare Workers Builds

Deploy odbywa się przez **Workers Builds** — natywną integrację Cloudflare z GitHub. Cloudflare automatycznie buduje i deployuje Workera po pushu do `main`. GitHub Actions pozostaje odpowiedzialny **tylko za CI (lint + build)**, nie za deploy.

### Podział odpowiedzialności

| Zadanie                              | Mechanizm                                   |
| ------------------------------------ | ------------------------------------------- |
| Lint + type-check + build            | GitHub Actions (`ci.yml`)                   |
| Deploy na produkcję (push do `main`) | Cloudflare Workers Builds                   |
| Preview deploy (inne branche)        | Cloudflare Workers Builds (preview trigger) |

### 5.1 GitHub Actions — tylko CI (bez deployu)

Zmodyfikować `.github/workflows/ci.yml` — **bez** joba deploy:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx astro sync
      - run: npm run lint
      - run: npm run build
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
```

- **Weryfikacja:**
  - [ ] Push zmianę do `main` → CI przechodzi (lint + build)
  - [ ] Otwórz PR → CI przechodzi na PR-ze
- **Support:** CI łapie błędy przed deployem. Workers Builds uruchamia się niezależnie od wyniku CI — jeśli CI failuje, to TY musisz nie mergować PR-a. Workers Builds nie czeka na wynik GitHub Actions

### 5.2 Podłączenie repozytorium do Workers Builds

- [x] Cloudflare Dashboard → Workers & Pages → Worker `flipit` → Settings → Builds → Connect
- [x] Wybrać GitHub → autoryzować Cloudflare GitHub App na repozytorium `flipit`
- [x] Skonfigurować:
  - **Production branch:** `main`
  - **Build command:** `npm run build`
  - **Deploy command:** `npx wrangler deploy`
  - **Root directory:** `/` (root projektu)
- [x] Zapisać konfigurację
- **Weryfikacja:** w sekcji Builds pojawi się status "Connected" z nazwą repozytorium
- **Edge case (Cloudflare GitHub App):** Cloudflare instaluje swoją GitHub App na repozytorium. Jeśli repo jest w organizacji, potrzebujesz uprawnień admina org do zatwierdzenia instalacji
- **Edge case (istniejący Worker):** Worker musi już istnieć (utworzony w Fazie 4 przez `wrangler deploy`). Workers Builds podłącza się do istniejącego Workera, nie tworzy nowego

### 5.3 Konfiguracja zmiennych środowiskowych build-time

Workers Builds potrzebuje zmiennych `SUPABASE_URL` i `SUPABASE_KEY` w trakcie budowania (Astro `astro:env/server` je odczytuje).

- [x] Cloudflare Dashboard → Worker `flipit` → Settings → Builds → Environment variables
- [x] Dodać zmienne dla triggera **Production**:
  - `SUPABASE_URL` = Project URL z Fazy 2.4 (`is_secret: true`)
  - `SUPABASE_KEY` = anon key z Fazy 2.4 (`is_secret: true`)
- [ ] (Opcjonalnie) Dodać te same zmienne dla triggera **Preview**
- **Weryfikacja:** zmienne widoczne na liście (wartości zamaskowane jeśli `is_secret: true`)
- **Edge case:** to są zmienne **build-time**, nie runtime. Runtime secrets ustawione przez `wrangler secret put` (Faza 4.1) pozostają osobno i nie są nadpisywane przez Workers Builds
- **Support:** zmienne build-time są potrzebne, ponieważ `astro:env/server` waliduje ich istnienie w trakcie buildu (choć są optional — bez nich build przechodzi, ale auth nie zadziała)

### 5.4 Test automatycznego deployu

- [ ] Wprowadzić widoczną zmianę w kodzie (np. zmienić tekst na stronie głównej)
- [ ] `git add . && git commit -m "test: workers builds auto-deploy" && git push`
- [ ] Cloudflare Dashboard → Worker `flipit` → Builds → sprawdzić, że build się uruchomił
- [ ] Po ukończeniu buildu — odwiedzić URL Workera i sprawdzić, że zmiana jest live
- **Weryfikacja:** zmiana widoczna na produkcji w ciągu ~2-3 minut od pusha
- **Edge case (build failure):** sprawdzić logi buildu w Cloudflare Dashboard → Builds → kliknąć na build. Najczęstsze przyczyny: brakujące zmienne środowiskowe (Faza 5.3), błąd Node.js version (Workers Builds domyślnie używa Node 18 — może wymagać ustawienia `NODE_VERSION=22` w zmiennych)
- **Edge case (Node version):** Workers Builds może nie używać Node 22 domyślnie. Dodać zmienną `NODE_VERSION` = `22` w build environment variables
- **Edge case (deploy succeeds but app broken):** natychmiast `npx wrangler rollback` z terminala

### 5.5 Weryfikacja preview deploy (opcjonalne)

Workers Builds automatycznie tworzy preview trigger dla branchy innych niż `main`.

- [ ] Utworzyć feature branch: `git checkout -b test-preview`
- [ ] Wprowadzić zmianę, commit, push
- [ ] Cloudflare Dashboard → Builds → sprawdzić, że preview build się uruchomił
- [ ] Preview deploy tworzy wersję Workera bez promocji na produkcję
- **Weryfikacja:** preview build kończy się sukcesem, produkcja pozostaje niezmieniona
- **Edge case:** preview deploy NIE jest automatycznie dostępny pod unikalnym URL (w przeciwieństwie do Cloudflare Pages). Preview wersja jest widoczna w Workers Versions, ale nie jest servowana. Dla pełnych preview URL-i rozważ migrację na Pages w przyszłości

### 5.6 Uwaga: kolejność — CI vs Workers Builds

Workers Builds uruchamia się **niezależnie** od GitHub Actions CI. Obie pipeline'y startują po pushu do `main`:

```
push do main
    ├── GitHub Actions CI (lint + build) ── informacyjny, nie blokuje deployu
    └── Workers Builds (build + deploy) ── deployuje niezależnie
```

- **Konsekwencja:** jeśli CI wykryje błąd lint, deploy i tak się wykona. To jest świadomy kompromis — Workers Builds nie ma mechanizmu "czekaj na CI"
- **Mitigation:** mergować do `main` tylko przez PR-y z wymaganym CI check. Ustaw **Branch Protection Rule** na GitHubie:
  - [ ] GitHub → Repo Settings → Branches → Add rule for `main`
  - [ ] Włączyć "Require status checks to pass before merging"
  - [ ] Wybrać check `ci` z GitHub Actions
  - [ ] (Opcjonalnie) "Require pull request reviews before merging"
- **Weryfikacja:** nie można mergować PR-a do `main` gdy CI failuje
- **Support:** to oznacza, że bezpośredni push do `main` omija CI check ale wciąż triggeruje deploy. Dla solo deva to akceptowalne — wymuszenie PR-ów jest opcjonalne ale zalecane

---

## Faza 6: Procedura rollback ⏳ Nice to have — zalecane przed pierwszym hotfixem

### 6.1 Mechanika rollback

- `npx wrangler rollback` — przywraca poprzedni deployment natychmiast (propagacja globalna ~30s)
- Rollback **NIE** przywraca wrangler secrets — jeśli zmieniono secret, trzeba go ustawić ponownie
- Rollback **NIE** przywraca zmian w bazie Supabase — migracje DB wymagają osobnej obsługi
- Można cofnąć tylko 1 wersję wstecz — dalsze cofanie wymaga deployu z konkretnego commita git

### 6.2 Test rollback

- [ ] Po udanym deployu, wprowadzić widoczną zmianę (np. zmienić nagłówek)
- [ ] Deploy: `npm run build && npx wrangler deploy`
- [ ] Sprawdzić, że zmiana jest live
- [ ] `npx wrangler rollback`
- [ ] Sprawdzić, że poprzednia wersja jest przywrócona
- **Weryfikacja:** nagłówek wraca do poprzedniego tekstu

### 6.3 Rollback awaryjny z CI

1. **Natychmiastowy:** `npx wrangler rollback` lokalnie (30s)
2. **Trwały:** `git revert <sha>` + push do `main` → CI deployuje zrevertowany kod

---

## Faza 7: Monitoring po deployu ⏳ Nice to have — przydatne przy debugowaniu produkcji

### 7.1 Monitoring bazowy

- [ ] `npx wrangler tail` — logi real-time (stdout, console.log, exceptions)
- [ ] `npx wrangler tail --format json` — structured output do parsowania
- [ ] `wrangler.jsonc` ma `"observability": { "enabled": true }` — Workers Logs w dashboardzie Cloudflare
- **Weryfikacja:** odwiedzić stronę, zobaczyć wpis w `wrangler tail`
- **Edge case:** `wrangler tail` = only real-time, zero persistence. Dla MVP akceptowalne. Logpush (→ R2 bucket) dodać gdy ruch to uzasadni

### 7.2 Monitoring kompatybilności runtime

- [ ] Po deployu sprawdzić `wrangler tail` pod kątem błędów `Module not found` / `X is not a function` (problemy z Node API na workerd)
- [ ] Rozważyć pinowanie `@supabase/supabase-js` i `@supabase/ssr` w `package.json` (exact versions)
- **Edge case:** aktualizacja `@supabase/supabase-js` może wprowadzić zależność od `node:net` lub `node:fs` — failuje runtime na Workers. **Zawsze testować `npx wrangler dev` po aktualizacji zależności**

### 7.3 Zarządzanie compatibility_date

- [ ] Obecna data: `"2026-05-08"` — NIE zmieniać bez testowania
- [ ] Procedura aktualizacji: zmienić datę → `npx wrangler dev` → przetestować → deploy
- **Edge case:** Cloudflare używa tej daty do gatowania zmian runtime. Brak narzędzi do preview efektów zmiany — odkrywasz je przez testowanie

---

## Faza 8: Custom domain ⏳ Nice to have — po MVP, gdy będzie własna domena

### 8.1 Dodanie domeny do Cloudflare

- [ ] Zarejestrować/przenieść domenę do Cloudflare
- [ ] Workers & Pages → flipit → Settings → Domains & Routes → Add custom domain
- [ ] Cloudflare automatycznie provision certyfikat SSL
- **Weryfikacja:** domena resolve na Workera, HTTPS działa

### 8.2 Aktualizacja Supabase po zmianie domeny

- [ ] Zmienić Site URL na custom domain
- [ ] Dodać custom domain do Redirect URLs
- [ ] Zachować `workers.dev` URL jako fallback
- **Weryfikacja:** flow auth działa z custom domain

---

## Kolejność wykonania

```
Faza -1 (gh login + build test) ── szybki krok
    │
Faza 0 (poprawki kodu) ──┐
Faza 2 (Supabase auth)  ──┤── mogą być wykonywane równolegle
Faza 3 (GitHub secrets) ──┘
    │
Faza 4 (pierwszy ręczny deploy) ── wymaga Faz 0, 2, 3
    │
    ├── Faza 2.5 (update Supabase Site URL z faktycznym URL Workera)
    │
Faza 5 (Workers Builds + CI) ── wymaga sprawdzonej Fazy 4
    │
Faza 6 (test rollback) ── wymaga Fazy 5
    │
Faza 7 (monitoring) ── ciągła po Fazie 4
Faza 8 (custom domain) ── opcjonalna, po MVP
```

## Pliki do modyfikacji

| Plik                            | Zmiana                                                                     |
| ------------------------------- | -------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`      | Branch `master`→`main`, **usunięcie** joba deploy (deploy robi Cloudflare) |
| `wrangler.jsonc`                | `name`: `10x-astro-starter`→`flipit`                                       |
| `supabase/config.toml`          | `project_id`: `10x-astro-starter`→`flipit`                                 |
| `src/pages/auth/callback.astro` | **nowy plik** — obsługa email confirmation callback                        |
| `.dev.vars.example`             | **nowy plik** — template zmiennych dla wrangler dev                        |

## Akcje wymagające ręcznej interwencji (human-only)

- [x] Logowanie GitHub CLI (Faza -1.1)
- [x] Zmiana szablonu emaila w Supabase (Faza 2.3)
- [x] Podłączenie repo do Workers Builds w dashboardzie Cloudflare (Faza 5.2)
- [x] Konfiguracja zmiennych build-time w Workers Builds (Faza 5.3)
- [ ] (Opcjonalnie) Branch Protection Rule na GitHub (Faza 5.6)
- [ ] Rotacja Supabase service-role key (jeśli kiedykolwiek potrzebna)
- [ ] Usunięcie Workera z Cloudflare
- [ ] Zmiany DNS (Faza 8)

## Szacowany czas (praca po godzinach)

| Faza      | Czas               | Uwagi                              |
| --------- | ------------------ | ---------------------------------- |
| Faza -1   | 10 min             | Logowanie gh, weryfikacja build    |
| Faza 0    | 30-60 min          | Poprawki kodu, callback endpoint   |
| Faza 1    | — (gotowe)         | Konto Cloudflare istnieje          |
| Faza 2    | 15 min             | Supabase Site URL + email template |
| Faza 3    | 5 min              | GitHub secrets (2 wpisy)           |
| Faza 4    | 30-60 min          | Pierwszy deploy + debugging        |
| Faza 5    | 20 min             | Workers Builds + CI workflow       |
| Faza 6    | 15 min             | Test rollback                      |
| Faza 7    | Ciągła             | Część regularnej pracy dev         |
| **Razem** | **~2.5-3.5 godz.** | 1 wieczór                          |
