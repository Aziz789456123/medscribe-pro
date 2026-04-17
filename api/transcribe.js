export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OpenAI key not configured' });

  try {
    // Read raw body as buffer
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // Forward to OpenAI Whisper as multipart
    const { FormData, Blob } = await import('node:buffer').catch(() => ({}));
    
    // Use native fetch with FormData
    const formData = new (await import('formdata-node').then(m => m.FormData).catch(() => null) || globalThis.FormData)();
    
    // Build multipart manually
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
    const contentType = req.headers['content-type'] || 'audio/webm';
    
    const whisperPrompt = `Transcription d'une consultation médicale en Tunisie. Le médecin parle en mélange de français médical et d'arabe tunisien dialectal (darija).
Mots tunisiens fréquents: lyoum/elyoum=aujourd'hui, barcha=beaucoup, chwaya=un peu, barka=assez, mrigel=bien/debout, maridh=malade, wجع/yوجع=douleur/faire mal, rass=tête, kalb=cœur, kerch=ventre, dhar=dos, riha=odeur/respiration, berd=froid/rhume, skhana=fièvre, demm=sang, echnou/chnia=quoi, kifeh=comment, win=où, fahemt=compris, yezzi=suffisant, ama=mais, tawa=maintenant, elli=qui/que, fama=il y a, mafish=il n'y a pas, aandou=il a, maandoush=il n'a pas, 3and=chez/avoir.
Termes médicaux courants dits en français: tension, glycémie, ordonnance, radiographie, analyse, chirurgie, urgence, prescription, antibiotique, douleur, fièvre, traitement.
Retranscris fidèlement le mélange des deux langues tel qu'il est prononcé.`;

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.webm"\r\nContent-Type: ${contentType}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n${whisperPrompt}\r\n`),
      Buffer.from(`--${boundary}--\r\n`)
    ]);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + OPENAI_KEY,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    return res.status(200).json({ text: data.text || '' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
