export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    const event = JSON.parse(body);

    // Handle successful payment
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.user_id || session.client_reference_id;

      if (userId && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        // Activate user account - extend trial by 30 days
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30);

        await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY
          },
          body: JSON.stringify({
            is_active: true,
            trial_end: trialEnd.toISOString()
          })
        });
      }
    }

    // Handle subscription renewal
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object;
      const customerId = invoice.customer;

      // Get customer email from Stripe
      const custResponse = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
        headers: { 'Authorization': 'Bearer ' + STRIPE_KEY }
      });
      const customer = await custResponse.json();

      if (customer.email && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30);

        await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${customer.email}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY
          },
          body: JSON.stringify({
            is_active: true,
            trial_end: trialEnd.toISOString()
          })
        });
      }
    }

    return res.status(200).json({ received: true });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
