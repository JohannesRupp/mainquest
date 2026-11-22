# MainQuest

Quests, Tasks und Zeittracking in einer PWA. Erledigte Tasks landen mit der getrackten Zeit automatisch im Google Kalender, ein Dashboard zeigt Fokuszeit, Verteilung nach Quests und Streak.

Läuft unter **https://mainquest.johannesrupp.com** und lässt sich auf dem iPhone über Safari → Teilen → „Zum Home-Bildschirm“ wie eine native App installieren.

## Features

- **Quests** (große Ziele) mit Farbe, Fortschritt und Gesamtzeit
- **Tasks** pro Quest, Notizen, manuelles Nachtragen von Zeit
- **Timer** mit Start/Stopp, immer nur einer läuft gleichzeitig, sichtbar als Leiste oben
- **Google-Kalender-Sync**: beim Abhaken wird jeder Zeitblock (ab 1 Minute) als Termin `✓ Taskname` eingetragen; Zielkalender wählbar
- **Dashboard**: heute, diese Woche, Fokuszeit pro Tag (gestapelt nach Quest), Zeit nach Quest, Streak
- **Sync über alle Geräte** via Supabase (Login per Magic Link)

## Tech-Stack

Vite · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth) · Google Identity Services · vite-plugin-pwa · Hosting auf Vercel

```
src/
  App.tsx              Auth-Gate, Navigation
  lib/store.tsx        Zentraler State + alle Supabase-Aktionen + Kalender-Sync
  lib/google.ts        OAuth-Token & Google Calendar API
  lib/time.ts          Zeitberechnungen
  views/               Tasks, Quests, Dashboard, Einstellungen, Login
supabase/schema.sql    Datenbankschema inkl. Row Level Security
```

## Setup

### 1. Supabase (Datenbank + Login)

1. Auf [supabase.com](https://supabase.com) ein kostenloses Projekt anlegen (Region Frankfurt).
2. **SQL Editor** → Inhalt von `supabase/schema.sql` einfügen → *Run*.
3. **Authentication → URL Configuration**:
   - Site URL: `https://mainquest.johannesrupp.com`
   - Redirect URLs: `https://mainquest.johannesrupp.com`, `http://localhost:5173`
4. **Project Settings → API**: `Project URL` und `anon public` Key kopieren.

### 2. Google Kalender

1. [Google Cloud Console](https://console.cloud.google.com) → neues Projekt „MainQuest“.
2. **APIs & Services → Library** → *Google Calendar API* aktivieren.
3. **OAuth consent screen**: Typ *External*, App-Name MainQuest, deine Mail als Testnutzer eintragen.
   Scopes: `calendar.events` und `calendar.calendarlist.readonly`.
4. **Credentials → Create Credentials → OAuth client ID** → Typ *Web application*.
   Authorized JavaScript origins: `https://mainquest.johannesrupp.com` und `http://localhost:5173`.
5. Die Client ID kopieren.

> Solange die App im Status „Testing“ ist, läuft der Zugriff nur für eingetragene Testnutzer, das reicht für den Eigengebrauch.

### 3. Lokal starten

```bash
cp .env.example .env   # Werte aus Schritt 1 und 2 eintragen
npm install
npm run dev            # http://localhost:5173
```

### 4. Deploy auf Vercel

1. Repo auf GitHub pushen (siehe unten).
2. [vercel.com](https://vercel.com) → *Add New Project* → Repo importieren (Framework: Vite wird erkannt).
3. **Environment Variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_CLIENT_ID`.
4. Deploy. Ab jetzt deployt jeder Push auf `main` automatisch.

### 5. Domain mainquest.johannesrupp.com

1. Vercel → Projekt → **Settings → Domains** → `mainquest.johannesrupp.com` hinzufügen.
2. Beim Domain-Anbieter einen DNS-Eintrag anlegen:

   | Typ   | Name        | Wert                   |
   |-------|-------------|------------------------|
   | CNAME | `mainquest` | `cname.vercel-dns.com` |

3. Nach ein paar Minuten ist die Seite inkl. HTTPS erreichbar.

## Repo auf GitHub anlegen

```bash
git remote add origin https://github.com/<dein-user>/mainquest.git
git push -u origin main
```

Oder mit der GitHub CLI: `gh repo create mainquest --public --source . --push`

## Ideen für später

- XP/Level-System für erledigte Quests
- Wiederkehrende Tasks und Deadlines
- Pomodoro-Modus
- Wochenreview als Mail
