// Serverless function för AI-bildanalys
// Denna fil kan användas med Vercel, Netlify Functions, eller liknande

export default async function handler(req, res) {
  // Tillåt endast POST-förfrågningar
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metod ej tillåten' });
  }

  try {
    const { image, mode, activeTemplate } = req.body;

    if (!image || !mode) {
      return res.status(400).json({ error: 'Bild och läge krävs' });
    }

    // Hämta API-nyckel från miljövariabler
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!OPENAI_API_KEY && !ANTHROPIC_API_KEY) {
      return res.status(500).json({ 
        error: 'AI API-nyckel saknas. Konfigurera OPENAI_API_KEY eller ANTHROPIC_API_KEY i miljövariabler.' 
      });
    }

    // Välj AI-provider (prioritera OpenAI GPT-4 Vision)
    let telemetry;
    
    if (OPENAI_API_KEY) {
      telemetry = await analyzeWithOpenAI(image, mode, activeTemplate, OPENAI_API_KEY);
    } else {
      telemetry = await analyzeWithAnthropic(image, mode, activeTemplate, ANTHROPIC_API_KEY);
    }

    return res.status(200).json({ telemetry });

  } catch (error) {
    console.error('AI-analysfel:', error);
    return res.status(500).json({ 
      error: 'AI-analys misslyckades', 
      details: error.message 
    });
  }
}

// OpenAI GPT-4 Vision analys
async function analyzeWithOpenAI(imageData, mode, activeTemplate, apiKey) {
  const prompt = buildAnalysisPrompt(mode, activeTemplate);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Du är en expert på fotografisk komposition och bildanalys. Analysera bilder och ge detaljerad teknisk feedback.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageData
              }
            }
          ]
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API-fel: ${response.statusText}`);
  }

  const data = await response.json();
  const analysisText = data.choices[0].message.content;

  return parseAIResponse(analysisText, mode);
}

// Anthropic Claude Vision analys
async function analyzeWithAnthropic(imageData, mode, activeTemplate, apiKey) {
  const prompt = buildAnalysisPrompt(mode, activeTemplate);

  // Ta bort data:image prefix om det finns
  const base64Image = imageData.replace(/^data:image\/\w+;base64,/, '');
  const mediaType = imageData.match(/^data:image\/(\w+);base64,/)?.[1] || 'jpeg';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: `image/${mediaType}`,
                data: base64Image
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic API-fel: ${response.statusText}`);
  }

  const data = await response.json();
  const analysisText = data.content[0].text;

  return parseAIResponse(analysisText, mode);
}

// Bygg analysprompt baserat på läge
function buildAnalysisPrompt(mode, activeTemplate) {
  const basePrompt = `Analysera denna bild ur ett fotografiskt kompositionsperspektiv för läget "${mode}".

Returnera din analys som ett JSON-objekt med följande struktur:
{
  "horizon_tilt_deg": <grader av lutning, negativt = medurs, positivt = moturs>,
  "horizon_y_pct": <horisontens position i procent från toppen, 0-100>,
  "saliency_subject_bbox": [x, y, width, height] <normaliserade koordinater 0-1 för huvudmotivet>,
  "rule_of_thirds_offset": <avstånd från närmaste tredjedels-punkt, 0-1>,
  "foreground_saliency": <hur intressant förgrunden är, 0-1>,
  "background_clutter": <hur rörig bakgrunden är, 0-1>,
  "composition_score": <övergripande kompositionspoäng, 0-100>,
  "technical_issues": [<lista med problem: "horizon_tilt", "background_clutter", "white_balance", "low_contrast">],
  "color_analysis": {
    "white_balance_shift": <Kelvin-förskjutning från neutral, -1000 till 1000>,
    "contrast_ratio": <kontrastförhållande, 0-1>,
    "color_cast": <färgstick om det finns: "blue", "yellow", "magenta", "green", eller null>
  },
  "ai_rationale": "<En kort svensk förklaring (1-2 meningar) om varför dessa förbättringar hjälper bilden>"
}`;

  if (mode === 'PORTRÄTT') {
    return basePrompt + `
  
Lägg även till:
  "faces": [{
    "bbox": [x, y, width, height],
    "gaze_dir_deg": <blickriktning i grader, 0 = rakt fram>,
    "head_tilt_deg": <huvudlutning>,
    "skin_tone_exposure": <hudtonexponering, 0-1>
  }],
  "exif_like": {
    "aperture": <rekommenderad bländare, f-nummer>,
    "shutter_s": <slutartid i sekunder>
  },
  "lighting": {
    "golden_hour": <true/false>,
    "optimal_light_eta": <minuter till bästa ljus, eller null>,
    "shadow_recovery_needed": <true/false>
  }`;
  }

  if (mode === 'ACTION') {
    return basePrompt + `

Lägg även till:
  "motion": {
    "subject_speed_px_s": <uppskattad hastighet i pixlar/sekund>,
    "panning_candidate": <true/false, om panorering rekommenderas>,
    "peak_action_eta": <sekunder till toppmomentet, eller null>
  },
  "exif_like": {
    "aperture": <rekommenderad bländare>,
    "shutter_s": <slutartid i sekunder>
  },
  "lighting": {
    "golden_hour": <true/false>,
    "optimal_light_eta": <minuter till bästa ljus, eller null>,
    "shadow_recovery_needed": <true/false>
  }`;
  }

  if (mode === 'LANDSKAP') {
    return basePrompt + `

Lägg även till:
  "exif_like": {
    "aperture": <rekommenderad bländare för landskapsfotografi>,
    "shutter_s": <slutartid i sekunder>
  },
  "lighting": {
    "golden_hour": <true/false>,
    "optimal_light_eta": <minuter till bästa ljus, eller null>,
    "shadow_recovery_needed": <true/false>
  }`;
  }

  return basePrompt;
}

// Parsea AI-svar till telemetri-objekt
function parseAIResponse(responseText, mode) {
  try {
    // Försök extrahera JSON från svaret
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Kunde inte hitta JSON i AI-svaret');
    }

    const telemetry = JSON.parse(jsonMatch[0]);

    // Validera att nödvändiga fält finns
    if (typeof telemetry.horizon_tilt_deg === 'undefined' ||
        typeof telemetry.composition_score === 'undefined') {
      throw new Error('AI-svaret saknar nödvändiga fält');
    }

    return telemetry;
  } catch (error) {
    console.error('Parsningsfel:', error);
    console.error('AI-svar:', responseText);
    throw new Error('Kunde inte parsea AI-analys: ' + error.message);
  }
}
