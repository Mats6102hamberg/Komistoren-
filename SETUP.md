# Kompistören - Installationsguide

## Steg-för-steg installation

### 1. Klona projektet

```bash
cd "Kompistören "
```

### 2. Installera beroenden

```bash
npm install
```

### 3. Konfigurera Firebase

#### 3.1 Skapa Firebase-projekt

1. Gå till [Firebase Console](https://console.firebase.google.com/)
2. Klicka på "Lägg till projekt"
3. Följ guiden för att skapa ett nytt projekt
4. Aktivera Google Analytics (valfritt)

#### 3.2 Aktivera Authentication

1. I Firebase Console, gå till **Authentication**
2. Klicka på **Kom igång**
3. Under **Sign-in method**, aktivera **Anonymous**

#### 3.3 Skapa Firestore Database

1. I Firebase Console, gå till **Firestore Database**
2. Klicka på **Skapa databas**
3. Välj **Starta i testläge** (för utveckling)
4. Välj en plats (t.ex. europe-west1)

#### 3.4 Hämta Firebase-konfiguration

1. I Firebase Console, gå till **Projektinställningar** (kugghjulet)
2. Scrolla ner till **Dina appar**
3. Klicka på **</>** (Webb-ikon)
4. Registrera appen med namn "Kompistören"
5. Kopiera konfigurationsobjektet

### 4. Konfigurera AI-tjänst

Välj **EN** av följande:

#### Alternativ A: OpenAI (Rekommenderat)

1. Skapa konto på [OpenAI Platform](https://platform.openai.com/)
2. Gå till [API Keys](https://platform.openai.com/api-keys)
3. Klicka på **Create new secret key**
4. Kopiera nyckeln (den visas bara en gång!)
5. Lägg till krediter på ditt konto (minst $5)

#### Alternativ B: Anthropic Claude

1. Skapa konto på [Anthropic Console](https://console.anthropic.com/)
2. Gå till **API Keys**
3. Klicka på **Create Key**
4. Kopiera nyckeln
5. Lägg till krediter på ditt konto

### 5. Skapa .env-fil

```bash
cp .env.example .env
```

Redigera `.env` och fyll i:

```env
# AI API (välj EN)
OPENAI_API_KEY=sk-proj-din-nyckel-här
# ELLER
ANTHROPIC_API_KEY=sk-ant-din-nyckel-här

# Firebase (från steg 3.4)
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=ditt-projekt.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ditt-projekt-id
VITE_FIREBASE_STORAGE_BUCKET=ditt-projekt.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

### 6. Skapa PWA-ikoner

Du behöver skapa två ikoner och placera dem i `public/`:

- `icon-192.png` (192x192 pixlar)
- `icon-512.png` (512x512 pixlar)

**Tips:** Använd ett verktyg som [Favicon.io](https://favicon.io/) eller skapa dem manuellt med:
- Kamera-emoji 📷 som bas
- Gradient-bakgrund (blå/grön)
- Rundade hörn

### 7. Starta utvecklingsserver

```bash
npm run dev
```

Appen öppnas automatiskt på `http://localhost:3000`

### 8. Testa appen

1. Välj ett läge (Landskap, Porträtt eller Action)
2. Ladda upp en testbild
3. Klicka på "Analysera med Kompistören"
4. Verifiera att AI-analysen fungerar

## Felsökning

### Problem: "Firebase Initialization Error"

**Lösning:**
- Kontrollera att alla `VITE_FIREBASE_*` variabler är korrekt ifyllda i `.env`
- Starta om utvecklingsservern efter att ha ändrat `.env`

### Problem: "AI-analys misslyckades"

**Lösning:**
- Kontrollera att API-nyckeln är giltig
- Verifiera att du har krediter på ditt AI-konto
- Kontrollera nätverksanslutningen
- Se konsolen för detaljerade felmeddelanden

### Problem: "Kunde inte ladda sparade kompositioner"

**Lösning:**
- Kontrollera att Firestore Database är aktiverad
- Verifiera att säkerhetsreglerna tillåter läsning/skrivning
- Kontrollera att användaren är inloggad (anonym auth)

### Problem: Service Worker registreras inte

**Lösning:**
- Service Workers fungerar bara över HTTPS (eller localhost)
- Kontrollera att `sw.js` finns i `public/`
- Rensa webbläsarens cache och ladda om

## Deployment

### Vercel

```bash
# Installera Vercel CLI
npm i -g vercel

# Logga in
vercel login

# Deploya
vercel

# Lägg till miljövariabler i Vercel Dashboard
# Settings → Environment Variables
```

### Netlify

```bash
# Installera Netlify CLI
npm i -g netlify-cli

# Logga in
netlify login

# Deploya
netlify deploy --prod

# Lägg till miljövariabler i Netlify Dashboard
# Site settings → Environment variables
```

## Firestore säkerhetsregler (Produktion)

När du går till produktion, uppdatera Firestore-reglerna:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/templates/{template} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Nästa steg

- Anpassa färger och design i `tailwind.config.js`
- Lägg till egna ikoner
- Konfigurera domännamn
- Aktivera Firebase Analytics
- Implementera fler analyslägen

## Support

Om du stöter på problem, kontrollera:
1. Konsolloggar i webbläsaren (F12)
2. Nätverksfliken för API-anrop
3. Firebase Console för databas-/auth-fel
