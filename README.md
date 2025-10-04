# Kompistören 📷

Din intelligenta kompositionscoach i realtid - en AI-driven PWA för att förbättra dina fotografiska kompositioner.

## ✨ Funktioner

- **🤖 AI-driven analys**: Använder GPT-4 Vision eller Claude för riktig bildanalys
- **📱 Progressive Web App**: Installera på mobil och desktop, fungerar offline
- **🎯 Tre analyslägen**: Landskap, Porträtt och Action
- **⚡ Realtidsanalys**: Ladda upp bilder och få omedelbar AI-återkoppling
- **🎨 Visuella överlägg**: Se kompositionsguider direkt på din bild
- **💾 Sparade mallar**: Spara och återanvänd framgångsrika kompositioner
- **☁️ Firebase-integration**: Synkronisera dina sparade kompositioner i molnet
- **🌐 Offline-stöd**: Service Worker cachar resurser för offline-användning

## 🚀 Snabbstart

### 1. Installation

```bash
# Installera beroenden
npm install
```

### 2. Konfigurera miljövariabler

Kopiera `.env.example` till `.env` och fyll i dina API-nycklar:

```bash
cp .env.example .env
```

Redigera `.env` och lägg till:
- **OpenAI API-nyckel** (för GPT-4 Vision) ELLER
- **Anthropic API-nyckel** (för Claude Vision)
- **Firebase-konfiguration** (från Firebase Console)

### 3. Starta utvecklingsserver

```bash
npm run dev
```

### 4. Bygg för produktion

```bash
npm run build
```

## Användning

1. Välj ett analysläge (Landskap, Porträtt eller Action)
2. Ladda upp en bild (max 10MB)
3. Klicka på "Analysera med Kompistören"
4. Följ de visuella guiderna och råden
5. Spara framgångsrika kompositioner för framtida referens

## 🛠️ Teknisk stack

- **React 18** - UI-ramverk
- **Vite** - Byggverktyg och dev-server
- **Tailwind CSS** - Stilsättning
- **Lucide React** - Ikoner
- **Firebase** - Backend, autentisering och databas
- **Canvas API** - Visuella överlägg
- **OpenAI GPT-4 Vision** eller **Anthropic Claude** - AI-bildanalys
- **Service Worker** - PWA och offline-funktionalitet

## 📦 Deployment

### Vercel

```bash
# Installera Vercel CLI
npm i -g vercel

# Deploya
vercel

# Lägg till miljövariabler i Vercel Dashboard:
# - OPENAI_API_KEY eller ANTHROPIC_API_KEY
# - Firebase-konfiguration
```

### Netlify

```bash
# Installera Netlify CLI
npm i -g netlify-cli

# Deploya
netlify deploy --prod

# Lägg till miljövariabler i Netlify Dashboard
```

## 🔧 Firebase-konfiguration

1. Skapa ett projekt på [Firebase Console](https://console.firebase.google.com/)
2. Aktivera Authentication (Anonymous)
3. Aktivera Firestore Database
4. Kopiera konfigurationen till `.env`:

```env
VITE_FIREBASE_API_KEY=din-api-nyckel
VITE_FIREBASE_AUTH_DOMAIN=ditt-projekt.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ditt-projekt-id
VITE_FIREBASE_STORAGE_BUCKET=ditt-projekt.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

## 🤖 AI-konfiguration

### OpenAI (Rekommenderat)

1. Skapa konto på [OpenAI Platform](https://platform.openai.com/)
2. Generera API-nyckel
3. Lägg till i `.env`:
```env
OPENAI_API_KEY=sk-proj-...
```

### Anthropic Claude (Alternativ)

1. Skapa konto på [Anthropic Console](https://console.anthropic.com/)
2. Generera API-nyckel
3. Lägg till i `.env`:
```env
ANTHROPIC_API_KEY=sk-ant-...
```

## 📱 PWA Installation

Appen kan installeras som en native app på:
- **iOS**: Safari → Dela → Lägg till på hemskärmen
- **Android**: Chrome → Meny → Installera app
- **Desktop**: Chrome/Edge → Adressfält → Installera-ikon

## 🔒 Säkerhet

- API-nycklar lagras endast på servern (aldrig i klienten)
- Firebase Authentication för användarhantering
- CORS-konfiguration för API-endpoints
- Content Security Policy headers

## 📄 Licens

MIT - Fri att använda och modifiera

## 🤝 Bidra

Pull requests välkomnas! För större ändringar, öppna först en issue för att diskutera vad du vill ändra.

## 📞 Support

Om du stöter på problem:
1. Kontrollera att alla miljövariabler är korrekt konfigurerade
2. Verifiera att Firebase-projektet är korrekt uppsatt
3. Kontrollera att AI API-nyckeln är giltig och har tillräckligt med krediter
