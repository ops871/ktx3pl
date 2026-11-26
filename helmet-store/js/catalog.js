/* ============================================================
   Product catalog — the single source of truth for tiers and prices.
   Loaded by the browser (window.CATALOG) AND by the checkout
   function on the server (require), so the server never trusts
   prices sent from the browser.
   Every helmet is a random draw: the team and signer are not chosen
   by the customer.
   All prices are in US cents. These are PLACEHOLDER prices.
   ============================================================ */
(function (root) {
  const CATALOG = {
    currency: 'usd',

    tiers: [
      {
        id: 'blaster-rip',
        name: 'Blaster Rip',
        helmetType: 'Mini Helmet',
        tagline: 'Mini lid, real ink. The rip that starts a collection.',
        price: 14900,
        rank: 1,
        description:
          'A random hand-signed mini helmet. Small enough for a desk or shelf and a great first piece for a collection.',
        features: [
          'Mini helmet (about half scale)',
          'Random team and signer',
          'Hand-signed on the shell',
          'Numbered Certificate of Authenticity',
          'Tamper-evident hologram sticker',
          'Ship it home or sell it back',
        ],
      },
      {
        id: 'hobby-rip',
        name: 'Hobby Rip',
        helmetType: 'Full-Size Replica',
        tagline: 'Full-size lid. Full-size hit.',
        price: 39900,
        rank: 2,
        description:
          'A random full-size replica helmet in authentic team colors and decals, signed by hand. Made for display, not for play.',
        features: [
          'Full-size replica helmet',
          'Random team and signer',
          'Hand-signed on the shell',
          'Numbered Certificate of Authenticity',
          'Tamper-evident hologram sticker',
          'Ship it home or sell it back',
          'Display-ready packaging',
        ],
      },
      {
        id: 'chase-rip',
        name: 'Chase Rip',
        helmetType: 'Speed Flex Authentic',
        tagline: 'The Speed Flex lid every collector chases.',
        price: 79900,
        rank: 3,
        featured: true,
        description:
          'A random full-size Speed Flex authentic helmet, the same model worn on the field, hand-signed and certified.',
        features: [
          'Full-size Speed Flex authentic helmet',
          'Random team and signer',
          'Hand-signed on the shell',
          'Numbered Certificate of Authenticity',
          'Tamper-evident hologram sticker',
          'Ship it home or sell it back',
          'Premium display packaging',
        ],
      },
      {
        id: 'grail-rip',
        name: 'Grail Rip',
        helmetType: 'Custom Build',
        tagline: 'One of one. The lid you rip for.',
        price: 129900,
        rank: 4,
        description:
          'A random one-of-one helmet with a custom paint design you won’t find anywhere else, hand-signed and certified.',
        features: [
          'Full-size helmet with a one-of-one custom design',
          'Random design, team and signer',
          'Hand-signed on the shell',
          'Numbered Certificate of Authenticity',
          'Tamper-evident hologram sticker',
          'Ship it home or sell it back',
          'Premium display packaging',
        ],
      },
    ],
  };

  CATALOG.findTier = function (id) {
    return CATALOG.tiers.find((t) => t.id === id) || null;
  };

  /** Price of one helmet in a tier (cents), or null for an unknown tier. */
  CATALOG.unitPrice = function (tierId) {
    const tier = CATALOG.findTier(tierId);
    return tier ? tier.price : null;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CATALOG;
  else root.CATALOG = CATALOG;
})(typeof window !== 'undefined' ? window : globalThis);
