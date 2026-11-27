/* ============================================================
   Rips data layer (Netlify Blobs).
   An ORDER is one purchase; it holds one RIP per helmet bought.
   Each rip moves through these statuses:

     awaiting_reveal → revealed → ship_requested → shipped
                                └→ sell_requested → paid

   Blob keys:
     order/<CODE>   { code, email, ripIds[], shipTo, source, createdAt }
     rip/<ID>       the rip record
     coa/<SERIAL>   rip id, so the Verify page can find revealed helmets
   ============================================================ */
const crypto = require('crypto');
const CATALOG = require('../../../js/catalog.js');

const STORE_NAME = 'lid-ripper';
const PAYOUT_METHODS = ['paypal', 'venmo', 'zelle', 'cashapp'];

function store(event) {
  // Tests inject an in-memory store; on Netlify we use Blobs.
  if (globalThis.__RIP_STORE__) return globalThis.__RIP_STORE__;
  const { connectLambda, getStore } = require('@netlify/blobs');
  if (event) connectLambda(event);
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

const now = () => new Date().toISOString();
const clean = (v, max = 200) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max);
const normEmail = (e) => clean(e, 254).toLowerCase();
const normCode = (c) => clean(c, 40).toUpperCase().replace(/\s+/g, '');
const randomId = (prefix, n = 8) => prefix + crypto.randomBytes(n).toString('hex').slice(0, n).toUpperCase();

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

function defaultBuyback(tierId) {
  const pct = Number(process.env.BUYBACK_PERCENT || 70);
  const tier = CATALOG.findTier(tierId);
  return tier ? Math.round((tier.price * pct) / 100) : 0;
}

/** Create an order and its rips. `items` is [{ tierId, qty }]. Idempotent on `code`. */
async function createOrder(s, { code, email, items, shipTo, source }) {
  code = normCode(code || randomId('LR-'));
  email = normEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('A valid customer email is required');

  const existing = await s.get('order/' + code, { type: 'json' });
  if (existing) return { order: existing, created: false };

  const ripIds = [];
  for (const it of items) {
    const tier = CATALOG.findTier(it.tierId);
    const qty = parseInt(it.qty, 10);
    if (!tier || !(qty >= 1 && qty <= 50)) throw new Error('Invalid item in order');
    for (let i = 0; i < qty; i++) {
      const rip = {
        id: randomId('R-'),
        orderCode: code,
        email,
        tierId: tier.id,
        status: 'awaiting_reveal',
        reveal: null,
        shipTo: null,
        payout: null,
        tracking: null,
        createdAt: now(),
        updatedAt: now(),
      };
      await s.setJSON('rip/' + rip.id, rip);
      ripIds.push(rip.id);
    }
  }
  if (!ripIds.length) throw new Error('Order has no helmets');
  const order = { code, email, ripIds, shipTo: clean(shipTo, 600) || null, source: source || 'manual', createdAt: now() };
  await s.setJSON('order/' + code, order);
  return { order, created: true };
}

async function getOrderRips(s, order) {
  const rips = [];
  for (const id of order.ripIds) {
    const r = await s.get('rip/' + id, { type: 'json' });
    if (r) rips.push(r);
  }
  return rips;
}

/** What a customer is allowed to see about a rip. */
function publicRip(r) {
  const tier = CATALOG.findTier(r.tierId);
  return {
    id: r.id,
    tierId: r.tierId,
    tierName: tier ? tier.name : r.tierId,
    helmetType: tier ? tier.helmetType : '',
    status: r.status,
    reveal: r.reveal && {
      team: r.reveal.team,
      signer: r.reveal.signer,
      item: r.reveal.item,
      coaSerial: r.reveal.coaSerial,
      buyback: r.reveal.buyback,
    },
    shipTo: r.shipTo,
    payout: r.payout && { method: r.payout.method },
    tracking: r.tracking,
  };
}

async function listRips(s) {
  const { blobs } = await s.list({ prefix: 'rip/' });
  const rips = [];
  for (const b of blobs) {
    const r = await s.get(b.key, { type: 'json' });
    if (r) rips.push(r);
  }
  return rips.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function parseBody(event) {
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
  try { return JSON.parse(raw || '{}'); } catch (e) { return null; }
}

module.exports = {
  CATALOG, PAYOUT_METHODS, store, now, clean, normEmail, normCode, json,
  defaultBuyback, createOrder, getOrderRips, publicRip, listRips, parseBody,
};
