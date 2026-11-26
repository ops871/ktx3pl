/* ============================================================
   COA lookup for helmets revealed through the admin page.
   GET /.netlify/functions/verify?serial=LR-000123
   The Verify page also checks data/certificates.json, so older
   certificates entered by hand keep working.
   ============================================================ */
const L = require('./lib/rips');

exports.handler = async (event) => {
  const serial = L.normCode((event.queryStringParameters || {}).serial);
  if (!serial) return L.json(400, { error: 'Missing serial' });
  const s = L.store(event);
  const ref = await s.get('coa/' + serial, { type: 'json' });
  const rip = ref && (await s.get('rip/' + ref.ripId, { type: 'json' }));
  if (!rip || !rip.reveal) return L.json(404, { error: 'Not found' });
  const r = rip.reveal;
  return L.json(200, {
    serial: r.coaSerial,
    tier: rip.tierId,
    item: r.item,
    team: r.team,
    signer: r.signer,
    inscription: r.inscription || '',
    signedOn: r.signedOn || '',
    witness: 'In-person private signing',
    hologram: r.hologram || '',
  });
};
