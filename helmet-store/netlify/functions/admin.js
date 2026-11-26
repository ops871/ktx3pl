/* ============================================================
   Admin endpoint. Requires header  Authorization: Bearer <ADMIN_TOKEN>
   (ADMIN_TOKEN is an environment variable you set in Netlify).
   POST { action: 'list' }
   POST { action: 'createOrder', email, items: [{ tierId, qty }], shipTo }
   POST { action: 'reveal', ripId, team, signer, item, coaSerial, buyback (cents), inscription, hologram }
   POST { action: 'markShipped', ripId, tracking }
   POST { action: 'markPaid', ripId, note }
   ============================================================ */
const crypto = require('crypto');
const L = require('./lib/rips');

function authorized(event) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || expected.length < 12) return false;
  const given = String((event.headers || {}).authorization || (event.headers || {}).Authorization || '').replace(/^Bearer\s+/i, '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return L.json(405, { error: 'Method not allowed' });
  if (!authorized(event)) return L.json(401, { error: 'Not authorized' });
  const body = L.parseBody(event);
  if (!body) return L.json(400, { error: 'Bad request' });
  const s = L.store(event);

  try {
    switch (body.action) {
      case 'list':
        return L.json(200, { rips: await L.listRips(s) });

      case 'createOrder': {
        const { order } = await L.createOrder(s, {
          email: body.email,
          items: Array.isArray(body.items) ? body.items : [],
          shipTo: body.shipTo,
          source: 'manual',
        });
        return L.json(200, { order });
      }

      case 'reveal': {
        const rip = await s.get('rip/' + body.ripId, { type: 'json' });
        if (!rip) return L.json(404, { error: 'Rip not found' });
        if (!['awaiting_reveal', 'revealed'].includes(rip.status)) return L.json(409, { error: 'Customer already chose ship or sell; reveal is locked.' });
        const coaSerial = L.normCode(body.coaSerial);
        const buyback = parseInt(body.buyback, 10);
        const reveal = {
          team: L.clean(body.team, 80),
          signer: L.clean(body.signer, 80),
          item: L.clean(body.item, 120) || (L.CATALOG.findTier(rip.tierId) || {}).helmetType,
          inscription: L.clean(body.inscription, 80),
          hologram: L.clean(body.hologram, 40),
          coaSerial,
          buyback: buyback >= 0 ? buyback : L.defaultBuyback(rip.tierId),
          signedOn: L.clean(body.signedOn, 20),
          revealedAt: L.now(),
        };
        if (!reveal.team || !reveal.signer || !coaSerial) return L.json(400, { error: 'Team, signer and COA serial are required.' });
        const holder = await s.get('coa/' + coaSerial, { type: 'json' });
        if (holder && holder.ripId !== rip.id) return L.json(409, { error: 'That COA serial is already used on another rip.' });
        if (rip.reveal && rip.reveal.coaSerial && rip.reveal.coaSerial !== coaSerial) await s.delete('coa/' + rip.reveal.coaSerial);
        await s.setJSON('coa/' + coaSerial, { ripId: rip.id });
        rip.reveal = reveal;
        rip.status = 'revealed';
        rip.updatedAt = L.now();
        await s.setJSON('rip/' + rip.id, rip);
        return L.json(200, { rip });
      }

      case 'markShipped':
      case 'markPaid': {
        const rip = await s.get('rip/' + body.ripId, { type: 'json' });
        if (!rip) return L.json(404, { error: 'Rip not found' });
        const ship = body.action === 'markShipped';
        if (rip.status !== (ship ? 'ship_requested' : 'sell_requested')) return L.json(409, { error: `Rip is "${rip.status}", not ready for that.` });
        rip.status = ship ? 'shipped' : 'paid';
        if (ship) rip.tracking = L.clean(body.tracking, 120) || null;
        else rip.payout.paidAt = L.now();
        if (body.note) rip.note = L.clean(body.note, 300);
        rip.updatedAt = L.now();
        await s.setJSON('rip/' + rip.id, rip);
        return L.json(200, { rip });
      }

      default:
        return L.json(400, { error: 'Unknown action' });
    }
  } catch (err) {
    return L.json(400, { error: err.message });
  }
};
