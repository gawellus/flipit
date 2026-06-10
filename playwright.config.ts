import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright',
  timeout: 30 * 1000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4321', // Twój port z Vite / Astro
    trace: 'on-first-retry',
  },
  projects: [
    // Projekt odpowiedzialny za logowanie i generowanie sesji
    { 
      name: 'setup', 
      testMatch: /auth\.setup\.ts/ 
    },
    // Główny projekt uruchamiający testy jako zalogowany użytkownik
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/auth.json', 
      },
      dependencies: ['setup'], // Powiązanie projektów
    },
  ],
});