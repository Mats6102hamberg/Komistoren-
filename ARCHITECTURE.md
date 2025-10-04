# Kompistören - Arkitektur & Teknisk Dokumentation

## Översikt

Kompistören är en AI-driven Progressive Web App (PWA) för fotografisk kompositionsanalys i realtid. Appen använder datorseende och AI för att analysera bilder och ge konkreta förbättringsförslag.

## Systemarkitektur

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Bildupplad  │  │   Canvas     │  │   Firebase   │  │
│  │     ning     │  │   Overlay    │  │     Auth     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              API Layer (Serverless)                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │     /api/analyze-composition.js                   │  │
│  │  • Bildvalidering                                 │  │
│  │  • AI-provider routing (OpenAI/Anthropic)        │  │
│  │  • Prompt engineering                             │  │
│  │  • Telemetri-parsning                            │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌──────────────────────┐   ┌──────────────────────┐
│   OpenAI GPT-4o      │   │  Anthropic Claude    │
│   Vision API         │   │  3.5 Sonnet          │
└──────────────────────┘   └──────────────────────┘
              │                         │
              └────────────┬────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Firebase Services                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Firestore DB │  │     Auth     │  │   Hosting    │  │
│  │  (Templates) │  │  (Anonymous) │  │   (Static)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Komponentstruktur

### Frontend (React)

```
src/
├── App.jsx                 # Huvudkomponent
│   ├── State Management    # useState hooks
│   ├── Firebase Integration
│   ├── AI Analysis Logic
│   ├── Canvas Rendering
│   └── UI Components
├── firebase.js             # Firebase konfiguration
├── main.jsx               # React entry point
└── index.css              # Global styles (Tailwind)
```

### Backend (Serverless Functions)

```
api/
└── analyze-composition.js
    ├── analyzeWithOpenAI()      # GPT-4 Vision integration
    ├── analyzeWithAnthropic()   # Claude Vision integration
    ├── buildAnalysisPrompt()    # Prompt engineering
    └── parseAIResponse()        # JSON parsing & validation
```

### PWA Assets

```
public/
├── manifest.json          # PWA manifest
├── sw.js                  # Service Worker
├── icon-192.png          # App icon (small)
├── icon-512.png          # App icon (large)
└── create-icons.html     # Icon generator tool
```

## Dataflöde

### 1. Bilduppladdning

```javascript
User uploads image
  → FileReader converts to base64
  → Image validation (size, dimensions)
  → State update (setImage)
  → UI preview rendered
```

### 2. AI-analys

```javascript
User clicks "Analysera"
  → handleAnalyze() triggered
  → analyzeImage() called
    → analyzeImageWithAI() sends POST to /api/analyze-composition
      → API validates request
      → buildAnalysisPrompt() creates mode-specific prompt
      → AI provider (OpenAI/Anthropic) analyzes image
      → parseAIResponse() extracts telemetry JSON
    → generateCommands() creates actionable suggestions
    → generateRationale() creates explanation
  → setAnalysis() updates state
  → drawOverlay() renders visual guides on canvas
```

### 3. Canvas Rendering

```javascript
drawOverlay() called
  → Get canvas & image refs
  → Set canvas dimensions to match image
  → Draw rule of thirds grid (green)
  → Draw horizon line if tilted (red)
  → Draw template targets if active (purple)
  → Draw panning indicator for action mode (blue)
  → Draw face bounding box for portraits (yellow)
```

### 4. Template Management

```javascript
Save Template:
  → User clicks save button
  → saveCurrentComposition() called
  → Firestore addDoc() to users/{uid}/templates
  → onSnapshot listener updates savedTemplates state

Load Template:
  → User clicks template
  → activateTemplate() called
  → setActiveTemplate() & setMode()
  → Re-analyze image with template comparison

Delete Template:
  → User clicks delete
  → deleteTemplate() called
  → Firestore deleteDoc()
  → onSnapshot updates state
```

## AI Prompt Engineering

### Prompt Structure

```
System: "Du är en expert på fotografisk komposition..."

User: 
  1. Mode-specific instructions (Landskap/Porträtt/Action)
  2. JSON schema definition
  3. Image (base64)

Response: JSON telemetry object
```

### Telemetri-schema

```typescript
interface Telemetry {
  // Komposition
  horizon_tilt_deg: number;        // -10 till 10
  horizon_y_pct: number;           // 0-100
  saliency_subject_bbox: [x, y, w, h]; // 0-1 normalized
  rule_of_thirds_offset: number;   // 0-1
  foreground_saliency: number;     // 0-1
  background_clutter: number;      // 0-1
  composition_score: number;       // 0-100
  
  // Tekniska problem
  technical_issues: string[];      // ["horizon_tilt", "white_balance", ...]
  
  // Färganalys
  color_analysis: {
    white_balance_shift: number;   // -1000 till 1000 K
    contrast_ratio: number;        // 0-1
    color_cast: string | null;     // "blue" | "yellow" | ...
  };
  
  // Lägesspecifika fält
  faces?: Face[];                  // Porträtt
  motion?: Motion;                 // Action
  exif_like?: ExifData;
  lighting?: LightingData;
  
  // AI-genererad förklaring
  ai_rationale: string;
}
```

## Kommandogenerering

### Prioritetssystem

```
Priority 0: Template matching (högst prioritet)
  - Tilt comparison
  - Horizon height comparison
  - Subject position comparison

Priority 1: Kritiska kompositionsproblem
  - Horizon tilt > 1.5°
  - White balance issues
  - Face gaze direction (portraits)
  - Motion blur settings (action)

Priority 2: Förbättringsförslag
  - Foreground interest
  - Golden hour timing
  - Contrast adjustments
```

### Kommandoformat

```javascript
{
  verb: string,        // "JUSTERA", "Vrid", "Öppna", etc.
  detail: string,      // Detaljerad instruktion
  priority: 0 | 1 | 2,
  icon: string         // Emoji för visuell feedback
}
```

## Canvas Overlay System

### Lager (från botten till topp)

1. **Tredjedelsregeln** (Grön, rgba(0, 255, 0, 0.5))
   - Vertikala linjer vid 33% och 67%
   - Horisontella linjer vid 33% och 67%

2. **Horisontlinje** (Röd, rgba(255, 0, 0, 0.8))
   - Visas om lutning > 1.5°
   - Streckad linje med lutningsvinkel
   - Text med grader

3. **Template Target** (Lila, rgba(150, 0, 255, 0.9))
   - Horisontmål (solid linje)
   - Subjektmål (cirkel med "MÅL" text)

4. **Panning Indicator** (Blå, rgba(0, 150, 255, 0.9))
   - Horisontell streckad linje
   - Pilhuvuden i båda riktningar
   - "FÖLJ RÖRELSEN" text

5. **Face Bounding Box** (Gul, rgba(255, 255, 0, 0.8))
   - Rektangel runt ansikten (porträttläge)

## Firebase Integration

### Autentisering

```javascript
// Anonymous authentication
signInAnonymously(auth)
  → User gets temporary UID
  → UID used for Firestore paths
```

### Firestore Schema

```
users/
  {userId}/
    templates/
      {templateId}/
        - name: string
        - mode: "LANDSKAP" | "PORTRÄTT" | "ACTION"
        - telemetry: Telemetry
        - createdAt: ISO timestamp
```

### Real-time Updates

```javascript
onSnapshot(collection(db, 'users', userId, 'templates'), 
  (snapshot) => {
    // Auto-updates savedTemplates state
  }
)
```

## PWA Features

### Service Worker Strategier

```javascript
// API calls: Network First
fetch('/api/*') 
  → Try network
  → Fallback to error response

// Static assets: Cache First
fetch('/*')
  → Try cache
  → Fallback to network
  → Update cache
```

### Offline Funktionalitet

- Cached UI och statiska resurser
- Sparade mallar synkroniseras när online
- Bildanalys kräver internetanslutning (AI API)

### Installationsupplevelse

```javascript
// manifest.json definierar:
- App namn och ikoner
- Display mode (standalone)
- Theme color
- Start URL
```

## Säkerhet

### API-nycklar

- ✅ Lagras på servern (miljövariabler)
- ✅ Aldrig exponerade i klientkod
- ✅ Serverless functions hanterar API-anrop

### Firebase Security Rules

```javascript
// Produktion
match /users/{userId}/templates/{template} {
  allow read, write: if request.auth.uid == userId;
}
```

### CORS & Headers

```javascript
// Vercel/Netlify konfiguration
Access-Control-Allow-Origin: *
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
```

## Performance Optimizations

### Code Splitting

```javascript
// vite.config.js
manualChunks: {
  'react-vendor': ['react', 'react-dom'],
  'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore']
}
```

### Image Optimization

- Max filstorlek: 10MB
- Max dimension: 4000px
- Base64 encoding för API-överföring

### Caching

- Service Worker cachar statiska resurser
- Firebase onSnapshot för real-time data
- Canvas rendering optimerad med useCallback

## Deployment Platforms

### Vercel (Rekommenderat)

- ✅ Automatisk serverless functions
- ✅ Edge network
- ✅ Miljövariabler i dashboard
- ✅ Automatisk HTTPS

### Netlify

- ✅ Netlify Functions support
- ✅ Form handling
- ✅ Split testing
- ✅ Deploy previews

## Framtida Förbättringar

### Planerade Features

1. **Batch Analysis** - Analysera flera bilder samtidigt
2. **Export Reports** - PDF-rapporter med analyser
3. **Social Sharing** - Dela analyser på sociala medier
4. **Advanced Templates** - Mer detaljerade mallar med metadata
5. **Camera Integration** - Live-analys från kamera
6. **Offline AI** - WebAssembly-baserad lokal analys
7. **Collaborative Features** - Dela mallar mellan användare
8. **Analytics Dashboard** - Spåra förbättringar över tid

### Tekniska Förbättringar

1. **TypeScript** - Typesäkerhet
2. **Testing** - Jest + React Testing Library
3. **CI/CD** - GitHub Actions
4. **Monitoring** - Sentry för felspårning
5. **A/B Testing** - Optimera AI-prompts
6. **Image Compression** - WebP/AVIF support
7. **Lazy Loading** - Optimera initial load

## Bidrag & Utveckling

### Setup Development Environment

```bash
npm install
cp .env.example .env
# Konfigurera .env
npm run dev
```

### Kodstandard

- ESLint för linting
- Prettier för formatering
- Kommentarer på svenska
- Semantiska commit-meddelanden

### Testing

```bash
npm run test        # Kör tester
npm run test:watch  # Watch mode
npm run coverage    # Coverage report
```

## Licens & Credits

- **Licens**: MIT
- **AI Models**: OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet
- **UI Framework**: React 18
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Backend**: Firebase
