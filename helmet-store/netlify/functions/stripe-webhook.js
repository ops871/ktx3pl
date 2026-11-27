/* ============================================================
   Stripe webhook: when a Checkout payment completes, create the order
   and its rips so the customer can see them on "My Rips".
   Set STRIPE_WEBHOOK_SECRET (whsec_...) in Netlify and point a Stripe
   webhook for "checkout.session.completed" at
   /.netlify/functions/stripe-webhook
   ============================================================ */
const crypto = require('crypto');
const L = require('./lib/rips');

const TOLERANCE_SECONDS = 300;

function verify(rawBody, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k, v]));
  const t = parseInt(parts.t, 10);
  if (!t || Math.abs(Date.now() / 1000 - t) > TOLERANCE_SECONDS) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return header.split(',').some((kv) => {
    const [k, v] = kv.split('=');
    return k === 'v1' && v && v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected));
  });
}

/** The order code a customer sees: derived from the Checkout Session id. */
const orderCodeFor = (sessionId) => 'LR-' + sessionId.slice(-8).toUpperCase();

function formatAddress(details) {
  if (!details || !details.address) return null;
  const a = details.address;
  return [details.name, a.line1, a.line2, [a.city, a.state, a.postal_code].filter(Boolean).join(' '), a.country].filter(Boolean).join('\n');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return L.json(405, { error: 'Method not allowed' });
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
  const sig = (event.headers || {})['stripe-signature'] || (event.headers || {})['Stripe-Signature'];
  if (!verify(raw, sig, process.env.STRIPE_WEBHOOK_SECRET)) return L.json(400, { error: 'Bad signature' });

  const evt = JSON.parse(raw);
  if (evt.type !== 'checkout.session.completed') return L.json(200, { ignored: evt.type });
  const session = evt.data.object;
  if (session.payment_status !== 'paid') return L.json(200, { ignored: 'unpaid' });

  // create-checkout.js stores the cart as "tierId:qty,tierId:qty".
  const items = String((session.metadata || {}).cart || '')
    .split(',')
    .map((p) => p.split(':'))
    .filter((p) => p.length === 2)
    .map(([tierId, qty]) => ({ tierId, qty: parseInt(qty, 10) }));

  const email = (session.customer_details || {}).email;
  const shipping = session.shipping_details || (session.collected_information || {}).shipping_details;
  const { created } = await L.createOrder(L.store(event), {
    code: orderCodeFor(session.id),
    email,
    items,
    shipTo: formatAddress(shipping),
    source: 'stripe',
  });
  return L.json(200, { ok: true, created });
};

exports.orderCodeFor = orderCodeFor;
exports.verify = verify;
