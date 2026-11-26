/* ============================================================
   Customer endpoint for "My Rips".
   POST { action: 'lookup', code, email }
   POST { action: 'ship',   code, email, ripId, shipTo }
   POST { action: 'sell',   code, email, ripId, method, handle }
   The order code + email pair is what proves the customer owns the order.
   ============================================================ */
const L = require('./lib/rips');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return L.json(405, { error: 'Method not allowed' });
  const body = L.parseBody(event);
  if (!body) return L.json(400, { error: 'Bad request' });

  const s = L.store(event);
  const code = L.normCode(body.code);
  const email = L.normEmail(body.email);
  const order = code && (await s.get('order/' + code, { type: 'json' }));
  // Same message for "no such order" and "wrong email" so codes can't be probed.
  if (!order || order.email !== email) return L.json(404, { error: 'No order found for that code and email.' });

  if (body.action === 'lookup') {
    const rips = await L.getOrderRips(s, order);
    return L.json(200, { code: order.code, defaultShipTo: order.shipTo, rips: rips.map(L.publicRip) });
  }

  if (body.action !== 'ship' && body.action !== 'sell') return L.json(400, { error: 'Unknown action' });
  if (!order.ripIds.includes(body.ripId)) return L.json(404, { error: 'That rip is not part of this order.' });

  const rip = await s.get('rip/' + body.ripId, { type: 'json' });
  if (!rip) return L.json(404, { error: 'Rip not found' });
  if (rip.status !== 'revealed') {
    return L.json(409, { error: rip.status === 'awaiting_reveal' ? 'This helmet has not been revealed yet.' : 'You already made a choice for this helmet.' });
  }

  if (body.action === 'ship') {
    const shipTo = L.clean(body.shipTo, 600);
    if (shipTo.length < 10) return L.json(400, { error: 'Please enter a full shipping address.' });
    rip.status = 'ship_requested';
    rip.shipTo = shipTo;
  } else {
    const method = L.clean(body.method, 20).toLowerCase();
    const handle = L.clean(body.handle, 120);
    if (!L.PAYOUT_METHODS.includes(method)) return L.json(400, { error: 'Pick a payout method.' });
    if (handle.length < 3) return L.json(400, { error: 'Enter where we should send your payout.' });
    rip.status = 'sell_requested';
    rip.payout = { method, handle, amount: rip.reveal.buyback, requestedAt: L.now() };
  }
  rip.updatedAt = L.now();
  await s.setJSON('rip/' + rip.id, rip);
  return L.json(200, { rip: L.publicRip(rip) });
};
