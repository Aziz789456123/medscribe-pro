export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { transcript, name, age, sex, type } = req.body;
  if (!transcript) return res.status(400).json({ error: 'Missing transcript', body: req.body });

  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(500).json({ error: 'API key not configured' });

  const prompt = `Tu es un médecin assistant. Voici une dictée médicale : "${transcript}". Patient : ${name || '?'}, ${age || '?'} ans, ${type || 'médecine générale'}. Génère un compte-rendu en JSON avec ces clés exactes : motif, anamnese, examen, conclusion, traitement, suivi.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_KEY
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data, prompt_sent: prompt });
    }

    const text = data.choices?.[0]?.message?.content || '{}';
    return res.status(200).json({ text, debug: 'groq_ok' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
