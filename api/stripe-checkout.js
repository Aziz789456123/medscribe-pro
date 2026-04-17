export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_KEY) return res.status(500).json({ error: 'Stripe key not configured' });

  try {
    // Parse body manually for Vercel
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }
    if (!body) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      try { body = JSON.parse(raw); } catch(e) { body = {}; }
    }

    const { email, userId } = body;
    if (!email || !userId) {
      return res.status(400).json({ error: `Missing fields: email=${email}, userId=${userId}` });
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + STRIPE_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'mode': 'subscription',
        'line_items[0][price]': 'price_1TNHzM1oat4pdsbsyS0sgNNi',
        'line_items[0][quantity]': '1',
        'customer_email': email,
        'client_reference_id': userId,
        'success_url': 'https://medscribe.zaanoun.dev?payment=success',
        'cancel_url': 'https://medscribe.zaanoun.dev?payment=cancelled',
        'metadata[user_id]': userId,
        'allow_promotion_codes': 'true'
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const session = await response.json();
    return res.status(200).json({ url: session.url });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
