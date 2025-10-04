import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, Zap, Loader, Info, RefreshCw, AlertCircle, Eye, Save, Trash2, CheckCircle, Target, X } from 'lucide-react';


// --- FIREBASE IMPORTS ---
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { auth, db as firebaseDb } from './firebase';


const Kompistoren = () => {
  // --- APP STATE ---
  const [mode, setMode] = useState('LANDSKAP');
  const [image, setImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [imageInfo, setImageInfo] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [uploadError, setUploadError] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);


  // --- TEMPLATE & DB STATE ---
  const [userId, setUserId] = useState(null);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [dbError, setDbError] = useState(null);


  // --- REFS & CONSTANTS ---
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_DIMENSION = 4000;


  const modes = [
    { id: 'LANDSKAP', icon: '🌄', label: 'Landskap', color: 'from-green-500 to-blue-500' },
    { id: 'PORTRÄTT', icon: '👤', label: 'Porträtt', color: 'from-purple-500 to-pink-500' },
    { id: 'ACTION', icon: '⚽', label: 'Action', color: 'from-orange-500 to-red-500' }
  ];


  // --- FIREBASE AUTH ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Firebase Auth Error:", error);
          setDbError('Kunde inte ansluta till databasen.');
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);


  // --- TEMPLATE FETCHING (onSnapshot) ---
  useEffect(() => {
    if (firebaseDb && userId) {
      const templateCollectionRef = collection(firebaseDb, 'users', userId, 'templates');
      
      const unsubscribe = onSnapshot(templateCollectionRef, (snapshot) => {
        const templates = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSavedTemplates(templates);
        setDbError(null);
      }, (error) => {
        console.error("Firestore listen error:", error);
        setDbError('Kunde inte ladda sparade kompositioner.');
      });

      return () => unsubscribe();
    }
  }, [userId]);


  // --- NEW DB FUNCTIONS ---


  const saveCurrentComposition = async (name) => {
    if (!firebaseDb || !userId || !analysis) {
      setDbError('Kunde inte spara. Försäkra dig om att du är inloggad och har en analys.');
      return;
    }
    setDbError(null);
    try {
      const templateCollectionRef = collection(firebaseDb, 'users', userId, 'templates');

      await addDoc(templateCollectionRef, {
        name: name || 'Ny Komposition',
        mode: analysis.mode,
        telemetry: analysis.telemetry,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error saving template:", e);
      setDbError('Ett fel uppstod när kompositionen skulle sparas.');
    }
  };


  const deleteTemplate = async (id) => {
    if (!firebaseDb || !userId) return;
    setDbError(null);
    try {
      const templateDocRef = doc(firebaseDb, 'users', userId, 'templates', id);
      await deleteDoc(templateDocRef);
      if (activeTemplate?.id === id) {
        setActiveTemplate(null);
      }
    } catch (e) {
      console.error("Error deleting template:", e);
      setDbError('Ett fel uppstod när kompositionen skulle raderas.');
    }
  };


  // Funktion för att aktivera en mall och starta om analys
  const activateTemplate = (template) => {
    if (activeTemplate?.id === template.id) {
      setActiveTemplate(null);
    } else {
      setActiveTemplate(template);
      setMode(template.mode);
      if (image) {
        setTimeout(handleAnalyze, 100);
      }
    }
  };


  // --- AI BILDANALYS ---
  const analyzeImageWithAI = useCallback(async (imageData, currentMode) => {
    const API_ENDPOINT = '/api/analyze-composition';
    
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageData,
          mode: currentMode,
          activeTemplate: activeTemplate
        })
      });

      if (!response.ok) {
        throw new Error(`AI-analys misslyckades: ${response.statusText}`);
      }

      const data = await response.json();
      return data.telemetry;
    } catch (error) {
      console.error('AI-analysfel:', error);
      throw error;
    }
  }, [activeTemplate]);


  // --- KOMMANDO GENERERING OCH REGLER (UPPDATERAD MED MALL-LOGIK) ---
  const generateCommands = useCallback((tel, currentMode, template) => {
    const cmds = [];
    const issues = tel.technical_issues || [];


    // --- TEMPLATE COMPARISON LOGIC (PRIORITY 0) ---
    if (template && template.mode === currentMode) {
      const tempTel = template.telemetry;
      
      // 1. Tilt Comparison (Landskap & Action)
      const tiltDiff = tel.horizon_tilt_deg - tempTel.horizon_tilt_deg;
      if (Math.abs(tiltDiff) > 1.5) {
        const dir = tiltDiff > 0 ? 'moturs' : 'medurs';
        cmds.push({
          verb: 'JUSTERA',
          detail: `kameran ${Math.abs(tiltDiff).toFixed(1)}° ${dir} för att matcha sparad vinkel` ,
          priority: 0,
          icon: '🎯'
        });
      }


      // 2. Horizon Height Comparison (Landskap)
      const horizonDiff = tel.horizon_y_pct - tempTel.horizon_y_pct;
      if (currentMode === 'LANDSKAP' && Math.abs(horizonDiff) > 5) {
        const direction = horizonDiff > 0 ? 'ner' : 'upp';
        cmds.push({
          verb: 'ANPASSA',
          detail: `kamerahöjden ${direction} för att matcha sparad horisont (${tempTel.horizon_y_pct.toFixed(0)}%)` ,
          priority: 0,
          icon: '📏'
        });
      }
      
      // 3. Subject Position Comparison (BBOX Y)
      const subjYDiff = tel.saliency_subject_bbox[1] - tempTel.saliency_subject_bbox[1];
      if (currentMode !== 'LANDSKAP' && Math.abs(subjYDiff) > 0.05) {
        const direction = subjYDiff > 0 ? 'upp' : 'ner';
        cmds.push({
          verb: 'POSITIONSJUSTERING',
          detail: `Flytta huvudmotivet ${direction} för att matcha sparad inramning` ,
          priority: 0,
          icon: '👤'
        });
      }
      
      // Om mallkommandon finns, returnera endast dessa (högsta prioritet)
      if (cmds.length > 0) {
        return cmds.slice(0, 3);
      }
    }
    // --- SLUT TEMPLATE COMPARISON LOGIC ---


    // --- ALLMÄNNA KOMMANDON (PRIORITY 1 & 2) ---


    // Ljus & Färg
    if (issues.includes('white_balance')) {
      const shift = tel.color_analysis.white_balance_shift;
      const preset = Math.abs(shift) > 500 ? 'skuggläge' : 'molnigt';
      cmds.push({ verb: 'Justera', detail: `vitbalans till ${preset} för att korrigera ${tel.color_analysis.color_cast || 'färgstick'}` , priority: 1, icon: '🎨' });
    }
    if (issues.includes('low_contrast')) {
      cmds.push({ verb: 'Öka', detail: 'kontrasten med +0.5 EV för mer punch i bilden', priority: 2, icon: '☀️' });
    }


    // Landskap
    if (currentMode === 'LANDSKAP') {
      if (issues.includes('horizon_tilt') || Math.abs(tel.horizon_tilt_deg) > 1.5) {
        cmds.push({ verb: 'Vrid', detail: `kameran ${Math.abs(tel.horizon_tilt_deg).toFixed(1)}° ${tel.horizon_tilt_deg > 0 ? 'moturs' : 'medurs'} för rak horisont` , priority: 1, icon: '🔄' });
      }
      if (Math.abs(tel.horizon_y_pct - 33.3) > 8 && Math.abs(tel.horizon_y_pct - 66.7) > 8) {
        const targetPct = tel.foreground_saliency > 0.6 ? 33 : 67;
        const direction = tel.horizon_y_pct > targetPct ? 'ner' : 'upp';
        cmds.push({ verb: 'Flytta', detail: `horisonten ${direction} till ${targetPct}% enligt tredjedelsregeln` , priority: 1, icon: '📐' });
      }
      if (tel.foreground_saliency < 0.4) {
        cmds.push({ verb: 'Sänk', detail: 'kameran till knähöjd för att skapa djup med förgrundselement', priority: 2, icon: '⬇️' });
      }
      if (tel.lighting.golden_hour && tel.lighting.optimal_light_eta) {
        cmds.push({ verb: 'Vänta', detail: `${tel.lighting.optimal_light_eta} minuter för gyllene timmesljus` , priority: 2, icon: '⏰' });
      }
    }


    // Porträtt
    if (currentMode === 'PORTRÄTT') {
      if (tel.faces?.[0]) {
        const face = tel.faces[0];
        if (Math.abs(face.gaze_dir_deg) > 20) {
          const dir = face.gaze_dir_deg > 0 ? 'höger' : 'vänster';
          cmds.push({ verb: 'Be', detail: `modellen vrida blicken ${Math.abs(face.gaze_dir_deg / 4).toFixed(0)}° åt ${dir} för att leda blicken` , priority: 1, icon: '👀' });
        }
        if (face.skin_tone_exposure < 0.5 && tel.lighting.shadow_recovery_needed) {
          cmds.push({ verb: 'Lyft', detail: 'skuggorna med +1.5 EV för bättre hudton', priority: 1, icon: '💡' });
        }
      }
      if (tel.exif_like.aperture > 4 && tel.background_clutter > 0.4) {
        cmds.push({ verb: 'Öppna', detail: `bländaren till f/${Math.max(1.8, tel.exif_like.aperture - 2).toFixed(1)} för bättre bakgrundsseparation (bokeh)` , priority: 1, icon: '📷' });
      }
    }


    // Action
    if (currentMode === 'ACTION') {
      if (tel.motion?.subject_speed_px_s > 250 && tel.exif_like.shutter_s > 1/500) {
        cmds.push({ verb: 'Byt', detail: 'till slutarprioritet 1/1000s för skarpa detaljer', priority: 1, icon: '⚡' });
      }
      if (tel.motion?.panning_candidate && tel.exif_like.shutter_s < 1/250) {
        cmds.push({ verb: 'Panorera', detail: 'med motivet och använd 1/125s för dynamisk rörelseoskärpa', priority: 1, icon: '🔄' });
      }
      if (tel.motion?.peak_action_eta) {
        cmds.push({ verb: 'Vänta', detail: `${tel.motion.peak_action_eta} sekunder för toppmomentet` , priority: 1, icon: '⏰' });
      }
    }


    return cmds.sort((a, b) => a.priority - b.priority).slice(0, 3);
  }, [activeTemplate]); // Beroende på activeTemplate



  const generateRationale = useCallback((commands, currentMode, aiRationale) => {
    if (aiRationale) {
      return aiRationale;
    }
    
    if (activeTemplate) {
      return "Följ de markerade målen för att exakt återskapa din sparade komposition.";
    }
    if (commands.length === 0) {
      return "Bra komposition! Små justeringar kan göra den ännu bättre.";
    }
    
    return "AI-analys genomförd. Följ rekommendationerna för bästa resultat.";
  }, [activeTemplate]);


  // --- CANVAS RENDER LOGIK (UPPDATERAD MED MALL-MÅL OCH PANORERING) ---
  const drawOverlay = useCallback(() => {
    if (!canvasRef.current || !imageRef.current || !analysis || !showOverlay) return;


    const canvas = canvasRef.current;
    const img = imageRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);


    const tel = analysis.telemetry;


    // 1. Tredjedelsregeln (Grönt)
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = canvas.height * 0.002;
    
    ctx.beginPath();
    ctx.moveTo(canvas.width / 3, 0); ctx.lineTo(canvas.width / 3, canvas.height);
    ctx.moveTo((2 * canvas.width) / 3, 0); ctx.lineTo((2 * canvas.width) / 3, canvas.height);
    ctx.moveTo(0, canvas.height / 3); ctx.lineTo(canvas.width, canvas.height / 3);
    ctx.moveTo(0, (2 * canvas.height) / 3); ctx.lineTo(canvas.width, (2 * canvas.height) / 3);
    ctx.stroke();
    ctx.setLineDash([]);



    // 2. Horisontlinje (Rött)
    if (Math.abs(tel.horizon_tilt_deg) > 1.5) {
      const horizonY = (tel.horizon_y_pct / 100) * canvas.height;
      const tiltRad = (tel.horizon_tilt_deg * Math.PI) / 180;
      
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = canvas.height * 0.003;
      ctx.setLineDash([canvas.height * 0.02, canvas.height * 0.01]); 
      
      ctx.beginPath();
      ctx.moveTo(0, horizonY - canvas.width * Math.tan(tiltRad) / 2);
      ctx.lineTo(canvas.width, horizonY + canvas.width * Math.tan(tiltRad) / 2);
      ctx.stroke();
      
      ctx.setLineDash([]);
      
      ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
      ctx.font = `bold ${canvas.height * 0.03}px Inter` ;
      ctx.textAlign = 'start'; // Återställ till standard
      ctx.fillText(`↻ ${Math.abs(tel.horizon_tilt_deg).toFixed(1)}°` , canvas.width * 0.02, horizonY - (canvas.height * 0.03));
    }


    // 3. Template Target (LILA) - Ritar målet om en mall är aktiv
    if (activeTemplate && activeTemplate.mode === mode) {
      const tempTel = activeTemplate.telemetry;
      
      // Horisont Mål (Kräver matchning i läge)
      const targetHorizonY = (tempTel.horizon_y_pct / 100) * canvas.height;
      ctx.strokeStyle = 'rgba(150, 0, 255, 0.9)'; // Lila
      ctx.lineWidth = canvas.height * 0.005;
      ctx.setLineDash([canvas.height * 0.02, 0]); // Solid linje som mål
      
      ctx.beginPath();
      ctx.moveTo(0, targetHorizonY);
      ctx.lineTo(canvas.width, targetHorizonY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Subject Target (Centrum av BBOX)
      const [x, y, w, h] = tempTel.saliency_subject_bbox;
      const centerX = (x + w / 2) * canvas.width;
      const centerY = (y + h / 2) * canvas.height;
      
      ctx.fillStyle = 'rgba(150, 0, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, canvas.height * 0.03, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(150, 0, 255, 1)';
      ctx.stroke();


      ctx.fillStyle = 'white';
      ctx.font = `bold ${canvas.height * 0.02}px Inter` ;
      ctx.textAlign = 'center';
      ctx.fillText('MÅL', centerX, centerY + canvas.height * 0.005);
    }


    // 4. Action Mode Panning Indicator (BLÅ)
    if (mode === 'ACTION' && tel.motion?.panning_candidate && analysis.commands.some(c => c.verb === 'Panorera')) {
        const arrowY = canvas.height * 0.5; // Centrerad vertikalt
        const headLen = canvas.height * 0.02;


        // 4a. Rita den streckade linjen (Rörelseguiden)
        ctx.strokeStyle = 'rgba(0, 150, 255, 0.9)'; // Blå
        ctx.lineWidth = canvas.height * 0.005;
        ctx.setLineDash([canvas.height * 0.02, canvas.height * 0.01]); 
        
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.05, arrowY);
        ctx.lineTo(canvas.width * 0.95, arrowY);
        ctx.stroke();
        ctx.setLineDash([]);


        // 4b. Rita pilhuvuden (Pekar åt båda hållen för "Följ")
        ctx.fillStyle = 'rgba(0, 150, 255, 0.9)';


        // Vänster pilhuvud
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.05, arrowY);
        ctx.lineTo(canvas.width * 0.05 + headLen, arrowY - headLen / 2);
        ctx.lineTo(canvas.width * 0.05 + headLen, arrowY + headLen / 2);
        ctx.closePath();
        ctx.fill();


        // Höger pilhuvud
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.95, arrowY);
        ctx.lineTo(canvas.width * 0.95 - headLen, arrowY - headLen / 2);
        ctx.lineTo(canvas.width * 0.95 - headLen, arrowY + headLen / 2);
        ctx.closePath();
        ctx.fill();
        
        // 4c. Textvägledning
        ctx.fillStyle = 'rgba(0, 150, 255, 1)';
        ctx.font = `bold ${canvas.height * 0.03}px Inter` ;
        ctx.textAlign = 'center';
        ctx.fillText('FÖLJ RÖRELSEN (Panorering)', canvas.width / 2, arrowY - canvas.height * 0.03);
    }
    
    // 5. Porträtt / Bbox för huvudmotiv (Gult/Orange)
    if (mode === 'PORTRÄTT' && tel.faces?.[0]) {
      const face = tel.faces[0];
      const [x, y, w, h] = face.bbox;
      
      const faceX = x * canvas.width;
      const faceY = y * canvas.height;
      const faceW = w * canvas.width;
      const faceH = h * canvas.height;
      
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
      ctx.lineWidth = canvas.height * 0.004;
      ctx.strokeRect(faceX, faceY, faceW, faceH);
    }
    ctx.textAlign = 'start'; // Återställ textAlign
  }, [analysis, mode, showOverlay, activeTemplate]);


  useEffect(() => {
    if (analysis && imageRef.current?.complete) {
      drawOverlay();
    }
  }, [analysis, showOverlay, drawOverlay]);



  // --- ANALYS OCH UPLOAD LOGIK ---


  const analyzeImage = useCallback(async (imageData, currentMode) => {
    try {
      const telemetry = await analyzeImageWithAI(imageData, currentMode);
      const commands = generateCommands(telemetry, currentMode, activeTemplate);
      const rationale = generateRationale(commands, currentMode, telemetry.ai_rationale);

      return {
        mode: currentMode,
        telemetry,
        commands,
        rationale,
        timestamp: new Date().toLocaleTimeString('sv-SE')
      };
    } catch (error) {
      throw new Error('Kunde inte analysera bilden med AI: ' + error.message);
    }
  }, [analyzeImageWithAI, generateCommands, generateRationale, activeTemplate]);


  const validateFile = (file) => {
    if (file.size > MAX_FILE_SIZE) {
      return `Filen är för stor (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 10MB för optimal bearbetning.` ;
    }
    return null;
  };


  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const error = validateFile(file);
      if (error) {
        setUploadError(error);
        setTimeout(() => setUploadError(null), 5000);
        return;
      }


      setUploadError(null);
      setImageInfo({
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
        type: file.type.split('/')[1]?.toUpperCase() || 'BILD'
      });


      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
            console.warn(`Bilden (${img.width}x${img.height}) är högre än rekommenderad maxupplösning.` );
          }
          setImage(event.target.result);
          setAnalysis(null);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };


  const handleAnalyze = useCallback(async () => {
    if (!image) return;

    setAnalyzing(true);
    setAnalysis(null);
    setUploadError(null);
    
    try {
      const result = await analyzeImage(image, mode);
      setAnalysis(result);
      setTimeout(() => drawOverlay(), 100);
    } catch (error) {
      console.error('Analysfel:', error);
      setUploadError('AI-analys misslyckades. Kontrollera din internetanslutning och försök igen.');
    } finally {
      setAnalyzing(false);
    }
  }, [image, mode, analyzeImage, drawOverlay]);


  const handleModeChange = (newMode) => {
    setMode(newMode);
    // Inaktivera mall om läget byts och mallen inte matchar
    if (activeTemplate && activeTemplate.mode !== newMode) {
      setActiveTemplate(null);
    }
    if (image && !analyzing) {
      setTimeout(() => {
        handleAnalyze();
      }, 300);
    }
  };
  
  const handleSaveClick = () => {
    setShowSaveModal(true);
  };

  const handleSaveSubmit = (name) => {
    if (name && name.trim()) {
      saveCurrentComposition(name.trim());
      setShowSaveModal(false);
    }
  };


  const currentModeConfig = modes.find(m => m.id === mode);

  // --- SAVE MODAL COMPONENT ---
  const SaveModal = () => {
    const [templateName, setTemplateName] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
      if (showSaveModal && inputRef.current) {
        inputRef.current.focus();
      }
    }, [showSaveModal]);

    if (!showSaveModal) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Save className="w-6 h-6 text-green-600" />
              Spara Komposition
            </h3>
            <button
              onClick={() => setShowSaveModal(false)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Stäng"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          <p className="text-slate-600 mb-4">
            Ge din komposition ett beskrivande namn för att enkelt hitta den senare.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveSubmit(templateName);
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="T.ex. Solnedgång vid havet"
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors text-lg"
              maxLength={50}
            />

            <div className="flex items-center justify-between mt-2 mb-4">
              <span className="text-sm text-slate-500">
                {templateName.length}/50 tecken
              </span>
              {analysis && (
                <span className="text-sm font-medium text-slate-600">
                  Läge: {analysis.mode}
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={!templateName.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                Spara
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };


  return (
    <div className={`min-h-screen font-sans bg-gradient-to-br ${currentModeConfig?.color} p-4 transition-all duration-500` }>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 pt-8">
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="relative">
              <Camera className="w-12 h-12 text-white drop-shadow-lg" />
              <Zap className="w-6 h-6 text-yellow-300 absolute -top-1 -right-1" />
            </div>
            <h1 className="text-5xl font-bold text-white drop-shadow-lg">Kompistören</h1>
          </div>
          <p className="text-white/90 text-lg drop-shadow">Din intelligenta kompositionscoach i realtid</p>
        </div>


        {dbError && (
          <div className="bg-orange-500/90 backdrop-blur-sm text-white p-4 rounded-xl mb-6 flex items-center gap-3 shadow-lg animate-in fade-in">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <p>{dbError}</p>
          </div>
        )}
        {uploadError && (
          <div className="bg-red-500/90 backdrop-blur-sm text-white p-4 rounded-xl mb-6 flex items-center gap-3 shadow-lg animate-in fade-in">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <p>{uploadError}</p>
          </div>
        )}


        {/* LÄGESVÄLJARE */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6">
          <p className="text-center text-lg font-semibold text-slate-700 mb-4">Välj analysläge:</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => handleModeChange(m.id)}
                className={`px-6 py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                  mode === m.id
                    ? `bg-gradient-to-r ${m.color} text-white shadow-lg scale-105` 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span className="mr-2 text-lg">{m.icon}</span>
                {m.label}
              </button>
            ))}
            <p className="text-xs text-slate-500 italic mt-2 w-full text-center">Obs! Byte av läge kommer att analysera om bilden om en är uppladdad.</p>
          </div>
        </div>


        {/* SPARADE KOMPOSITIONER */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" /> Sparade Kompositioner ({savedTemplates.length})
          </h2>
          {activeTemplate && (
            <div className="bg-purple-100 text-purple-800 p-3 rounded-lg mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Aktiv mall: <span className="font-semibold">{activeTemplate.name}</span> (Läge: {activeTemplate.mode})
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {savedTemplates.length === 0 ? (
              <p className="text-slate-500 italic">Inga sparade mallar. Analysera en bild och klicka på Spara för att skapa en.</p>
            ) : (
              savedTemplates.map(t => (
                <div 
                  key={t.id} 
                  className={`flex items-center justify-between p-3 rounded-lg text-sm transition-all shadow-sm ${
                    activeTemplate?.id === t.id ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  <span className={`font-medium ${activeTemplate?.id === t.id ? 'text-white' : 'text-slate-700'}` }>{t.name} ({t.mode.slice(0, 3)})</span>
                  <div className="flex ml-3 gap-1">
                    <button 
                      onClick={() => activateTemplate(t)}
                      className={`p-1 rounded-md transition-colors ${activeTemplate?.id === t.id ? 'bg-white/20 hover:bg-white/30' : 'hover:bg-purple-200 text-purple-600'}` }
                      title={activeTemplate?.id === t.id ? 'Avaktivera mall' : 'Aktivera som guide'}
                    >
                      {activeTemplate?.id === t.id ? <CheckCircle className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => deleteTemplate(t.id)}
                      className={`p-1 rounded-md transition-colors ${activeTemplate?.id === t.id ? 'bg-white/20 hover:bg-red-500' : 'hover:bg-red-200 text-red-600'}` }
                      title="Radera mall"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>


        {/* BILDUPLOAD OCH FÖRHANDSGRANSKNING */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          
          {!image ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-3 border-dashed border-slate-300 rounded-2xl p-16 text-center cursor-pointer hover:bg-slate-50 transition-all duration-300 group"
            >
              <Upload className="w-20 h-20 mx-auto mb-6 text-slate-400 group-hover:text-slate-600 transition-colors" />
              <p className="text-xl text-slate-600 font-medium mb-2">Ladda upp ett foto för analys</p>
              <p className="text-slate-500">Klicka eller dra och släpp. (Max 10MB)</p>
              <p className="text-xs text-slate-400 italic mt-2">Du kan behöva ladda upp en ny bild efter byte av läge för att få ny analys.</p>
            </div>
          ) : (
            <div className="relative group">
              <div className="relative flex justify-center">
                {/* Bilden visas */}
                <img
                  ref={imageRef}
                  src={image}
                  alt="Uppladdad bild"
                  className="w-full h-auto max-h-96 object-contain mx-auto rounded-xl shadow-lg" 
                  onLoad={drawOverlay} 
                  style={{maxWidth: '100%'}}
                />
                {/* Canvas för överlägg */}
                <canvas
                  ref={canvasRef}
                  className="absolute pointer-events-none"
                  style={{
                    display: showOverlay && analysis ? 'block' : 'none',
                    width: imageRef.current?.offsetWidth || '100%',
                    height: imageRef.current?.offsetHeight || 'auto'
                  }}
                />
              </div>
              
              {/* Överlagringsknappar */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 rounded-xl flex items-end justify-between p-4">
                <button
                  onClick={() => setShowOverlay(!showOverlay)}
                  className={`bg-white/90 hover:bg-white px-4 py-2 rounded-lg shadow-md text-sm font-medium transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300 flex items-center gap-2 ${!analysis ? 'opacity-50 cursor-not-allowed' : ''}` }
                  disabled={!analysis}
                >
                  <Eye className="w-4 h-4" />
                  {showOverlay ? 'Dölj' : 'Visa'} överlägg
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white/90 hover:bg-white px-4 py-2 rounded-lg shadow-md text-sm font-medium transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300"
                >
                  Byt bild
                </button>
              </div>
              
              {imageInfo && (
                <div className="mt-3 bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
                  <Info className="w-4 h-4 inline mr-2" />
                  {imageInfo.name} • {imageInfo.size} • {imageInfo.type}
                </div>
              )}
            </div>
          )}
        </div>


        {image && (
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className={`w-full bg-gradient-to-r ${currentModeConfig?.color} hover:shadow-xl disabled:bg-slate-400 text-white font-bold py-5 rounded-2xl shadow-lg transition-all duration-300 flex items-center justify-center gap-3 mb-6 transform hover:scale-[1.02] disabled:scale-100` }
          >
            {analyzing ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
            {analyzing ? 'Analyserar komposition...' : 'Analysera med Kompistören'}
          </button>
        )}


        {/* ANALYSRESULTAT */}
        {analysis && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                🧠 Kompistörens Råd
                <span className="text-sm font-normal bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                  {analysis.telemetry.composition_score}% komposition
                </span>
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveClick}
                  title="Spara denna komposition"
                  className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-md"
                >
                  <Save className="w-5 h-5" />
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Analysera om"
                >
                  <RefreshCw className={`w-5 h-5 text-slate-600 ${analyzing ? 'animate-spin' : ''}` } />
                </button>
              </div>
            </div>


            <div className="space-y-4">
              {analysis.commands.length > 0 ? (
                analysis.commands.map((cmd, idx) => (
                  <div
                    key={idx}
                    className={`bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 ${cmd.priority === 0 ? 'border-purple-600 bg-purple-50' : 'border-blue-600'}` }
                  >
                    <div className="flex items-start gap-4">
                      <span className={`rounded-xl w-10 h-10 flex items-center justify-center font-bold flex-shrink-0 text-lg ${cmd.priority === 0 ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'}` }>
                        {cmd.icon}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-red-600 text-lg">{cmd.verb}</span>
                          {cmd.priority === 0 && <span className="bg-purple-200 text-purple-800 text-xs px-2 py-1 rounded-full font-medium">MALLMÅL</span>}
                          {cmd.priority > 0 && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">PRIO {cmd.priority}</span>}
                        </div>
                        <p className="text-slate-700 text-lg">{cmd.detail}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-600 p-5 rounded-xl text-center">
                  <p className="text-green-800 font-medium text-lg">
                    👍 Utmärkt komposition! Bilden är välbalanserad och följer goda fotografiska principer.
                  </p>
                </div>
              )}
            </div>


            <div className="bg-slate-50/80 border border-slate-200 p-5 rounded-xl">
              <p className="text-slate-700 italic text-lg">
                <strong className="text-slate-800">Varför detta förbättrar bilden:</strong>{' '}
                {analysis.rationale}
              </p>
            </div>


            <details className="group">
              <summary className="cursor-pointer font-semibold text-slate-600 hover:text-slate-800 text-lg flex items-center gap-2">
                <Info className="w-5 h-5" />
                📊 Teknisk analys och telemetri
                <span className="text-sm font-normal text-slate-500 ml-2">
                  (Analyserad {analysis.timestamp})
                </span>
              </summary>
              <div className="mt-4 bg-slate-800 text-green-400 p-5 rounded-xl overflow-x-auto">
                <pre className="text-sm">
                  {JSON.stringify(analysis.telemetry, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        )}

        {/* SAVE MODAL */}
        <SaveModal />
      </div>
    </div>
  );
};


export default Kompistoren;
