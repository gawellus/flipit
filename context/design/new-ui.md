# Flipit — Mapa ekranów do redesignu UI

Dokument opisuje wszystkie ekrany aplikacji Flipit wraz z ich zawartością i stanami.
Przeznaczony dla specjalisty UX/UI do zaprojektowania makiet w Figmie — bez wglądu w kod.

---

## Ekrany publiczne (niezalogowany użytkownik)

### 1. Landing Page (`/`)

- Hero section z nazwą aplikacji i krótkim opisem (aplikacja do nauki fiszek z powtórkami)
- Dwa CTA: „Zaloguj się" i „Zarejestruj się"
- Sekcja z kartami prezentującymi kluczowe funkcje (generowanie AI, powtórki, kolekcje)
- Topbar z linkami „Sign in" / „Sign up"

### 2. Logowanie (`/auth/signin`)

- Pole email z walidacją formatu
- Pole hasło z przyciskiem pokaż/ukryj
- Przycisk „Zaloguj się"
- Link do rejestracji („Nie masz konta?")
- Miejsce na komunikat błędu serwera (np. złe dane logowania)

**Stany do zaprojektowania:** domyślny, błąd logowania

### 3. Rejestracja (`/auth/signup`)

- Pole email
- Pole hasło (min. 6 znaków) z licznikiem znaków i przyciskiem pokaż/ukryj
- Pole potwierdzenia hasła z przyciskiem pokaż/ukryj
- Walidacja w czasie rzeczywistym: długość hasła, zgodność haseł
- Przycisk „Zarejestruj się"
- Link do logowania („Masz już konto?")
- Miejsce na komunikat błędu

**Stany do zaprojektowania:** domyślny, błąd walidacji

### 4. Potwierdzenie email (`/auth/confirm-email`)

- Komunikat o pomyślnej rejestracji
- Instrukcja sprawdzenia skrzynki email i kliknięcia linku potwierdzającego
- Link powrotny do logowania

---

## Wspólna nawigacja (Topbar)

Topbar pojawia się na wszystkich ekranach.

**Wariant zalogowany:**

- Email użytkownika (po lewej)
- Menu nawigacyjne (po prawej): Generuj, Fiszki, Nauka, Dashboard, Wyloguj

**Wariant niezalogowany:**

- Tekst „Niezalogowany" (po lewej)
- Linki: Zaloguj się, Zarejestruj się (po prawej)

**Uwaga:** Topbar powinien obsłużyć wersję mobilną (hamburger menu lub inny pattern).

---

## Ekrany chronione (zalogowany użytkownik)

### 5. Dashboard (`/dashboard`)

- Powitanie z emailem użytkownika
- Przycisk „Wyloguj się"
- Informacja o zalogowaniu / krótki opis dostępnych funkcji

### 6. Generowanie fiszek AI (`/generate`)

Ten ekran ma **5 stanów**, które designer powinien zaprojektować:

#### Stan A — Formularz

- Pole tekstowe (textarea) na tekst źródłowy, z którego AI wygeneruje fiszki
- Licznik znaków (max 10 000)
- Przycisk „Generuj"

#### Stan B — Ładowanie

- Spinner / animacja z komunikatem „Generowanie fiszek..."

#### Stan C — Przegląd propozycji

- Lista wygenerowanych fiszek (każda z pytaniem i odpowiedzią)
- Przy każdej fiszce: przyciski Akceptuj / Odrzuć / Edytuj + badge statusu
- Przycisk „Akceptuj wszystkie" (globalny)
- Przycisk „Zapisz zaakceptowane"
- Tryb edycji inline (textarea na przód i tył fiszki)

#### Stan D — Sukces

- Komunikat o liczbie zapisanych fiszek
- Przycisk „Generuj kolejne"

#### Stan E — Błąd

- Komunikat o błędzie
- Przycisk „Spróbuj ponownie"

### 7. Moje fiszki (`/flashcards`)

- **Pole wyszukiwania** (max 200 znaków) — filtrowanie w czasie rzeczywistym
- **Przycisk „Dodaj fiszkę"** — rozwija formularz tworzenia inline

#### Formularz tworzenia fiszki

- Textarea „Przód" (max 2000 znaków) z licznikiem
- Textarea „Tył" (max 2000 znaków) z licznikiem
- Przyciski Zapisz / Anuluj

#### Lista fiszek — każda karta zawiera

- Treść przodu (pytanie/termin)
- Treść tyłu (odpowiedź/definicja)
- Badge źródła: „AI" (niebieski) lub „Ręczna" (fioletowy)
- Dropdown przypisania do kolekcji
- Przycisk Edytuj (przełącza na tryb edycji inline)
- Przycisk Usuń (z potwierdzeniem — 3-sekundowy timer do cofnięcia)

#### Tryb edycji (zamienia widok karty)

- Edytowalne textarea przód/tył
- Przyciski Zapisz / Anuluj

#### Paginacja

- Numer strony, nawigacja prev/next, info o łącznej liczbie fiszek

#### Stany puste

- Brak fiszek w ogóle → komunikat zachęcający do dodania
- Brak wyników wyszukiwania → „Nie znaleziono fiszek"

### 8. Kolekcje / Nauka (`/study`)

- **Przycisk „Utwórz kolekcję"** — rozwija formularz inline

#### Formularz tworzenia kolekcji

- Pole tekstowe na nazwę (max 200 znaków, autofocus)
- Przyciski Utwórz / Anuluj

#### Lista kolekcji — każda karta zawiera

- Nazwa kolekcji
- Badge z liczbą fiszek (łącznie)
- Badge z liczbą fiszek do powtórki (kolorowy jeśli > 0, przygaszony jeśli 0)
- Przycisk „Ucz się" (nieaktywny jeśli brak fiszek)
- Przycisk „Usuń" (z potwierdzeniem)

#### Stan pusty

- Komunikat zachęcający do utworzenia pierwszej kolekcji

### 9. Sesja nauki (`/study/{collectionId}`)

Ten ekran ma **4 stany:**

#### Stan A — Ładowanie

- Spinner z komunikatem „Ładowanie fiszek..."

#### Stan B — Nauka (główny)

- Wskaźnik postępu: „Fiszka X z Y"
- **Karta fiszki z animacją 3D flip:**
  - Przód: treść pytania + przycisk „Pokaż odpowiedź"
  - Tył: treść odpowiedzi + 4 przyciski oceny
- **4 przyciski oceny** (widoczne po odwróceniu karty):
  - „Znowu" — z podglądem interwału (np. „<1m")
  - „Trudne" — z podglądem interwału (np. „6m")
  - „Dobrze" — z podglądem interwału (np. „10m")
  - „Łatwe" — z podglądem interwału (np. „4d")

#### Stan C — Sesja ukończona

- Komunikat „Sesja ukończona!"
- Liczba przeglądniętych fiszek
- Informacja o następnej powtórce (np. „Następna powtórka za 2h")
- Przycisk „Wróć do kolekcji"

#### Stan D — Brak fiszek do powtórki

- Komunikat „Wszystko powtórzone!"
- Informacja kiedy następna powtórka (jeśli dotyczy)
- Lub: „Brak fiszek przypisanych do tej kolekcji"
- Przyciski: „Wróć do kolekcji" / „Dodaj fiszki"

---

## Podsumowanie — checklist dla designera

| #   | Ekran               | Warianty/stany do zaprojektowania                            |
| --- | ------------------- | ------------------------------------------------------------ |
| 1   | Landing page        | 1                                                            |
| 2   | Logowanie           | 2 (domyślny + błąd)                                          |
| 3   | Rejestracja         | 2 (domyślny + błąd walidacji)                                |
| 4   | Potwierdzenie email | 1                                                            |
| 5   | Dashboard           | 1                                                            |
| 6   | Generowanie AI      | 5 (formularz, ładowanie, przegląd, sukces, błąd)             |
| 7   | Moje fiszki         | 5+ (lista, tworzenie, edycja, usuwanie, pusty, brak wyników) |
| 8   | Kolekcje            | 3 (lista, tworzenie, pusty)                                  |
| 9   | Sesja nauki         | 4 (ładowanie, nauka z flipem, ukończona, brak fiszek)        |
| —   | Topbar              | 2 (zalogowany, niezalogowany)                                |

**Łącznie: 9 ekranów, ~25 stanów/wariantów do zaprojektowania.**

---

## Elementy design systemu do uwzględnienia

- **Animacja 3D flip** karty fiszki (przód <-> tył)
- **Badge'e źródła**: AI (niebieski) vs Ręczna (fioletowy)
- **Potwierdzenie usunięcia** z 3-sekundowym timerem (nie modal, a zmiana stanu przycisku)
- **Liczniki znaków** przy polach tekstowych
- **Przełącznik widoczności hasła** (ikona oka)
- **Stany przycisków**: domyślny, hover, loading/spinner, disabled
- **Responsywność**: wersja desktop + mobile dla każdego ekranu

---

## Modele danych (kontekst dla designera)

### Fiszka

- Przód (pytanie/termin) — max 2000 znaków
- Tył (odpowiedź/definicja) — max 2000 znaków
- Źródło: „AI" lub „Ręczna"
- Opcjonalne przypisanie do kolekcji
- Data utworzenia i aktualizacji

### Kolekcja

- Nazwa — max 200 znaków
- Liczba fiszek (łącznie)
- Liczba fiszek do powtórki (due)

### Sesja nauki

- Fiszki do powtórki w danej kolekcji
- System ocen: Znowu / Trudne / Dobrze / Łatwe
- Algorytm FSRS (Free Spaced Repetition Scheduler) — automatycznie planuje kolejne powtórki na podstawie oceny użytkownika
- Podgląd interwału przy każdym przycisku oceny (np. „za 1 minutę", „za 4 dni")
