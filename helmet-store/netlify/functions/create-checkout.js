/* ============================================================
   Creates a Stripe Checkout Session for the cart.
   Prices are recomputed here from js/catalog.js — the browser only
   sends tier ids, options and quantities.
   Requires the STRIPE_SECRET_KEY environment variable in Netlify.
   ============================================================ */
const CATALOG = require('../../js/catalog.js');

const SHIPPING_FLAT = 2500; // cents; keep in sync with js/config.js
const MAX_QTY = 10;
const TEXT_FIELDS = ['team', 'signer', 'inscription', 'personalizationName', 'personalizationNumber'];

function clean(v, max) {
  return String(v || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
}

function validateItem(raw) {
  const tier = CATALOG.findTier(raw && raw.tierId);
  if (!tier) throw new Error('Unknown helmet tier');
  const qty = parseInt(raw.qty, 10);
  if (!(qty >= 1 && qty <= MAX_QTY)) throw new Error('Invalid quantity');

  const o = raw.options || {};
  const options = {};
  TEXT_FIELDS.forEach((k) => { if (o[k]) options[k] = clean(o[k], 60); });
  if (!options.signer) throw new Error('Each helmet needs a signer');
  if (tier.options.includes('team') && !options.team) throw new Error('Each helmet needs a team');

  if (tier.options.includes('shellColor')) {
    for (const g of ['shellColor', 'facemaskColor', 'finish']) {
      if (!CATALOG.findOption(g, o[g])) throw new Error('Invalid custom option');
      options[g] = o[g];
    }
    if (options.personalizationNumber && !/^[0-9]{1,2}$/.test(options.personalizationNumber)) {
      throw new Error('Invalid personalization number');
    }
  } else {
    delete options.personalizationName;
    delete options.personalizationNumber;
  }
  return { tier, qty, options, unit: CATALOG.unitPrice(tier.id, options) };
}

function describe(tierId, o) {
  const parts = [];
  if (o.team) parts.push('Team: ' + o.team);
  if (o.shellColor) parts.push('Shell: ' + CATALOG.findOption('shellColor', o.shellColor).label);
  if (o.facemaskColor) parts.push('Facemask: ' + CATALOG.findOption('facemaskColor', o.facemaskColor).label);
  if (o.finish) parts.push('Finish: ' + CATALOG.findOption('finish', o.finish).label);
  if (o.personalizationName || o.personalizationNumber) {
    parts.push('Personalized: ' + [o.personalizationName, o.personalizationNumber && '#' + o.personalizationNumber].filter(Boolean).join(' '));
  }
  parts.push('Signer: ' + o.signer);
  if (o.inscription) parts.push('Inscription: ' + o.inscription);
  return parts.join(' · ');
}

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
  p.append('success_url', `${origin}/#/success/paid`);
  p.append('cancel_url', `${origin}/#/cart`);
  p.append('billing_address_collection', 'required');
  p.append('shipping_address_collection[allowed_countries][0]', 'US');
  p.append('phone_number_collection[enabled]', 'true');
  p.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  p.append('shipping_options[0][shipping_rate_data][display_name]', 'Insured shipping');
  p.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(SHIPPING_FLAT));
  p.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', CATALOG.currency);

  items.forEach((it, i) => {
    const desc = describe(it.tier.id, it.options);
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
