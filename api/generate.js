export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { transcript, name, age, sex, type } = req.body;
  if (!transcript) return res.status(400).json({ error: 'Missing transcript' });

  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(500).json({ error: 'API key not configured' });

  const prompt = `Tu es un secrétaire médical. Tu dois retranscrire UNIQUEMENT ce que le médecin a dit. Tu n'inventes RIEN. Tu n'ajoutes AUCUNE information médicale supplémentaire. Si une information n'est pas dans la dictée, tu écris exactement "Non mentionné".

DICTÉE DU MÉDECIN :
"${transcript}"

Retranscris cette dictée en JSON avec ces 6 clés. Reste STRICTEMENT fidèle aux mots du médecin :
- motif : ce que le médecin dit comme motif de consultation
- anamnese : les symptômes et antécédents mentionnés
- examen : les éléments d'examen clinique mentionnés (sinon "Non mentionné")
- conclusion : le diagnostic mentionné
- traitement : les traitements et prescriptions mentionnés
- suivi : les recommandations de suivi mentionnées

RÈGLE ABSOLUE : N'écris que ce qui est dans la dictée. Pas de "il est probable que", pas de "éventuellement", pas d'inventions.`;

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

