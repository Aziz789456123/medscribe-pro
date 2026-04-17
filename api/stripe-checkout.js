export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_KEY) return res.status(500).json({ error: 'Stripe key not configured' });

  const { email, userId } = req.body;
  if (!email || !userId) return res.status(400).json({ error: 'Missing email or userId' });

  try {
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
        'subscription_data[trial_period_days]': '0',
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
