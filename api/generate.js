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

  // Language instructions
  const langMap = {
    fr: 'Réponds en français.',
    ar: 'Réponds en arabe (العربية). Utilise la terminologie médicale arabe standard.',
    en: 'Reply in English. Use standard medical English terminology.'
  };
  const langInstr = langMap[lang] || langMap.fr;

  // Template-specific sections
  const templateMap = {
    cardio: 'Pour la cardiologie, inclure dans examen : fréquence cardiaque, tension artérielle, auscultation cardiaque, pouls périphériques, signes d\'insuffisance cardiaque.',
    dermato: 'Pour la dermatologie, inclure dans examen : description des lésions (type, taille, couleur, localisation, évolution), atteinte muqueuse.',
    pediatrie: 'Pour la pédiatrie, inclure dans examen : poids, taille, périmètre crânien, développement psychomoteur, vaccinations.',
    urgences: 'Pour les urgences, inclure : score de triage, constantes vitales complètes, orientation (hospitalisation/sortie).',
    standard: ''
  };
  const templateInstr = templateMap[template] || '';

  const prompt = `Tu es un secrétaire médical. Retranscris UNIQUEMENT ce que le médecin a dit. N'invente RIEN. Si une information n'est pas dans la dictée, écris "Non mentionné". ${langInstr} ${templateInstr}

DICTÉE : "${transcript}"
Patient : ${name || '?'}, ${age || '?'} ans, ${sex || '?'}, ${type || 'médecine générale'}

JSON avec ces 6 clés exactes (rien d'autre) :
{"motif":"...","anamnese":"...","examen":"...","conclusion":"...","traitement":"...","suivi":"..."}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_KEY
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.0,
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
