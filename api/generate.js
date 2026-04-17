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

  // Language-specific instructions
  const langInstructions = {
    fr: {
      system: "Tu es un médecin assistant expert francophone. Tu rédiges des comptes-rendus médicaux professionnels en français.",
      instruction: "Rédige le compte-rendu en français avec la terminologie médicale française standard.",
      notMentioned: "Non mentionné"
    },
    tn: {
      system: "Tu es un médecin assistant expert spécialisé dans les consultations médicales en Tunisie. Tu comprends parfaitement le mélange de français médical et d'arabe tunisien dialectal (darija). Tu rédiges des comptes-rendus médicaux professionnels en français standard.",
      instruction: `La dictée contient du français et de l'arabe tunisien dialectal mélangés (darija). 
Vocabulaire tunisien courant: lyoum/elyoum=aujourd'hui, barcha=beaucoup, chwaya=un peu, mrigel=bien/debout, maridh=malade, yوجع/wجع=douleur, rass=tête, kalb=cœur, kerch=ventre, dhar=dos, skhana=fièvre, demm=sang, berd=rhume, mafish=il n'y a pas, aandou=il a, maandoush=il n'a pas.
Traduis et structure TOUT le contenu en français médical professionnel. Ne laisse aucun mot en arabe dans le compte-rendu final.`,
      notMentioned: "Non mentionné"
    },
    ar: {
      system: "أنت مساعد طبيب خبير. تكتب التقارير الطبية باللغة العربية.",
      instruction: "اكتب التقرير الطبي باللغة العربية مع استخدام المصطلحات الطبية الصحيحة.",
      notMentioned: "غير مذكور"
    },
    en: {
      system: "You are an expert medical assistant. You write professional medical reports in English.",
      instruction: "Write the medical report in English using standard medical terminology.",
      notMentioned: "Not mentioned"
    }
  };

  const l = langInstructions[lang] || langInstructions.fr;
  const nm = l.notMentioned;

  // Template-specific additions
  const templateExtra = {
    cardio: lang === 'ar'
      ? 'للقلب: اذكر معدل ضربات القلب، ضغط الدم، تسمع القلب، علامات فشل القلب.'
      : lang === 'en'
      ? 'For cardiology: include heart rate, blood pressure, cardiac auscultation, signs of heart failure.'
      : 'Pour la cardiologie : inclure fréquence cardiaque, tension artérielle, auscultation cardiaque, signes d\'insuffisance cardiaque.',
    dermato: lang === 'ar'
      ? 'للجلدية: وصف الآفات (نوع، حجم، لون، موقع، تطور).'
      : lang === 'en'
      ? 'For dermatology: describe lesions (type, size, color, location, progression).'
      : 'Pour la dermatologie : décrire les lésions (type, taille, couleur, localisation, évolution).',
    pediatrie: lang === 'ar'
      ? 'لطب الأطفال: اذكر الوزن، الطول، محيط الرأس، التطور الحركي، التطعيمات.'
      : lang === 'en'
      ? 'For pediatrics: include weight, height, head circumference, motor development, vaccinations.'
      : 'Pour la pédiatrie : inclure poids, taille, périmètre crânien, développement, vaccinations.',
    urgences: lang === 'ar'
      ? 'للطوارئ: اذكر درجة الفرز، العلامات الحيوية الكاملة، القرار (دخول/خروج).'
      : lang === 'en'
      ? 'For emergencies: include triage score, full vital signs, decision (admission/discharge).'
      : 'Pour les urgences : inclure score de triage, constantes vitales complètes, décision (hospitalisation/sortie).',
    standard: ''
  };

  const extra = templateExtra[template] || '';

  const prompt = lang === 'ar'
    ? `${l.system}

${l.instruction} ${extra}

إملاء الطبيب: "${transcript}"
المريض: ${name || '؟'}, ${age || '؟'} سنة, ${sex || '؟'}, ${type || 'طب عام'}

اكتب JSON فقط بهذه المفاتيح الستة بدون أي نص آخر:
{"motif":"...","anamnese":"...","examen":"...","conclusion":"...","traitement":"...","suivi":"..."}

إذا لم يُذكر شيء، اكتب "${nm}" في ذلك الحقل.`
    : lang === 'en'
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
