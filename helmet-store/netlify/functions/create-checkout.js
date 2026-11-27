/* ============================================================
   Creates a Stripe Checkout Session for the cart.
   Prices are recomputed here from js/catalog.js — the browser only
   sends tier ids and quantities.
   Requires the STRIPE_SECRET_KEY environment variable in Netlify.
   ============================================================ */
const CATALOG = require('../../js/catalog.js');

const SHIPPING_FLAT = 2500; // cents; keep in sync with js/config.js
const MAX_QTY = 10;

// Every helmet is a random draw, so an item is just a tier and a quantity.
function validateItem(raw) {
  const tier = CATALOG.findTier(raw && raw.tierId);
  if (!tier) throw new Error('Unknown helmet tier');
  const qty = parseInt(raw.qty, 10);
  if (!(qty >= 1 && qty <= MAX_QTY)) throw new Error('Invalid quantity');
  return { tier, qty, unit: CATALOG.unitPrice(tier.id) };
}

const describe = (tier) =>
  tier.id === 'grail-rip' ? 'USA custom paint · random signer' : 'Random team & signer';

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json(500, { error: 'Checkout is not configured yet.' });

  let items;
  try {
    const body = JSON.parse(event.body || '{}');
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 20) throw new Error('Cart is empty');
    items = body.items.map(validateItem);
  } catch (err) {
    return json(400, { error: err.message });
  }

  const origin = process.env.URL || `https://${event.headers.host}`;
  const p = new URLSearchParams();
  p.append('mode', 'payment');
  // Stripe fills in {CHECKOUT_SESSION_ID}; the success page turns it into the order code.
  p.append('success_url', `${origin}/?session_id={CHECKOUT_SESSION_ID}#/success/paid`);
  p.append('cancel_url', `${origin}/#/cart`);
  p.append('billing_address_collection', 'required');
  p.append('shipping_address_collection[allowed_countries][0]', 'US');
  p.append('phone_number_collection[enabled]', 'true');
  p.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  p.append('shipping_options[0][shipping_rate_data][display_name]', 'Insured shipping');
  p.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(SHIPPING_FLAT));
  p.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', CATALOG.currency);

  // Read by stripe-webhook.js to create one rip per helmet.
  p.append('metadata[cart]', items.map((it) => `${it.tier.id}:${it.qty}`).join(','));
  items.forEach((it, i) => {
    const desc = `${describe(it.tier)} · Hand-signed with Certificate of Authenticity`;
    p.append(`line_items[${i}][quantity]`, String(it.qty));
    p.append(`line_items[${i}][price_data][currency]`, CATALOG.currency);
    p.append(`line_items[${i}][price_data][unit_amount]`, String(it.unit));
    p.append(`line_items[${i}][price_data][product_data][name]`, `${it.tier.name} (${it.tier.helmetType})`);
    p.append(`line_items[${i}][price_data][product_data][description]`, desc);
    // Also stored on the session so the full spec shows in the Stripe dashboard.
    p.append(`metadata[item_${i + 1}]`, `${it.tier.name} x${it.qty} | ${desc}`.slice(0, 500));
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: p.toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Stripe error', data.error);
    return json(502, { error: 'Could not start checkout. Please try again.' });
  }
  return json(200, { url: data.url });
};
