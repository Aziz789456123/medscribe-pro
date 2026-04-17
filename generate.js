export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { transcript, name, age, sex, type, lang, template } = req.body;
  if (!transcript) return res.status(400).json({ error: 'Missing transcript' });

  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(500).json({ error: 'API key not configured' });

  const langInstructions = {
    fr: {
      system: "Tu es un médecin assistant expert francophone. Tu rédiges des comptes-rendus médicaux professionnels en français avec une terminologie médicale précise et structurée.",
      instruction: "Rédige le compte-rendu en français médical standard. Utilise la terminologie médicale française officielle. Sois précis, concis et professionnel.",
      notMentioned: "Non mentionné"
    },
    en: {
      system: "You are an expert medical assistant. You write professional medical reports in English using standard medical terminology.",
      instruction: "Write the medical report in English using standard medical terminology. Be precise, concise and professional.",
      notMentioned: "Not mentioned"
    }
  };

  const l = langInstructions[lang] || langInstructions.fr;
  const nm = l.notMentioned;

  const templateExtra = {
    cardio: lang === 'en'
      ? 'For cardiology: include heart rate, blood pressure, cardiac auscultation, signs of heart failure, ECG results if mentioned.'
      : 'Pour la cardiologie : inclure fréquence cardiaque, tension artérielle, auscultation cardiaque, signes d\'insuffisance cardiaque, résultats ECG si mentionnés.',
    dermato: lang === 'en'
      ? 'For dermatology: describe lesions in detail (type, size, color, location, borders, progression).'
      : 'Pour la dermatologie : décrire les lésions en détail (type, taille, couleur, localisation, contours, évolution).',
    pediatrie: lang === 'en'
      ? 'For pediatrics: include weight, height, head circumference, developmental milestones, vaccination status.'
      : 'Pour la pédiatrie : inclure poids, taille, périmètre crânien, développement psychomoteur, statut vaccinal.',
    urgences: lang === 'en'
      ? 'For emergencies: include triage score, complete vital signs, Glasgow score if relevant, decision (admission/discharge).'
      : 'Pour les urgences : inclure score de triage, constantes vitales complètes, score de Glasgow si pertinent, décision (hospitalisation/sortie).',
    standard: ''
  };

  const extra = templateExtra[template] || '';

  const prompt = lang === 'en'
    ? `${l.system}

${l.instruction} ${extra}

Doctor's dictation: "${transcript}"
Patient: ${name || '?'}, ${age || '?'} years old, ${sex || '?'}, ${type || 'general medicine'}

Write ONLY a JSON object with these 6 keys, nothing else:
{"motif":"...","anamnese":"...","examen":"...","conclusion":"...","traitement":"...","suivi":"..."}

If something is not mentioned, write "${nm}" in that field.`
    : `${l.system}

${l.instruction} ${extra}

Dictée du médecin : "${transcript}"
Patient : ${name || '?'}, ${age || '?'} ans, ${sex || '?'}, ${type || 'médecine générale'}

Écris UNIQUEMENT un objet JSON avec ces 6 clés, sans aucun autre texte :
{"motif":"...","anamnese":"...","examen":"...","conclusion":"...","traitement":"...","suivi":"..."}

Si quelque chose n'est pas mentionné, écris "${nm}" dans ce champ.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_KEY
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    return res.status(200).json({ text });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
