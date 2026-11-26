/* ============================================================
   Product catalog — the single source of truth for tiers and prices.
   Loaded by the browser (window.CATALOG) AND by the checkout
   function on the server (require), so the server never trusts
   prices sent from the browser.
   All prices are in US cents. These are PLACEHOLDER prices.
   ============================================================ */
(function (root) {
  const CATALOG = {
    currency: 'usd',

    tiers: [
      {
        id: 'rookie-ink',
        name: 'Rookie Ink',
        helmetType: 'Mini Helmet',
        tagline: 'Where every collection starts.',
        price: 14900,
        rank: 1,
        description:
          'A detailed mini helmet, hand-signed and certified. Small enough for a desk or shelf and a great first piece for a collection.',
        features: [
          'Mini helmet (about half scale)',
          'Hand-signed on the shell',
          'Numbered Certificate of Authenticity',
          'Tamper-evident hologram sticker',
        ],
        options: ['team', 'signer', 'inscription'],
      },
      {
        id: 'starter-ink',
        name: 'Starter Ink',
        helmetType: 'Full-Size Replica',
        tagline: 'Full size. Full signature.',
        price: 39900,
        rank: 2,
        description:
          'A full-size replica helmet with authentic team colors and decals, signed by hand. Made for display, not for play.',
        features: [
          'Full-size replica helmet',
          'Hand-signed on the shell',
          'Numbered Certificate of Authenticity',
          'Tamper-evident hologram sticker',
          'Display-ready packaging',
        ],
        options: ['team', 'signer', 'inscription'],
      },
      {
        id: 'franchise-ink',
        name: 'Franchise Ink',
        helmetType: 'Speed Flex Authentic',
        tagline: 'The helmet the pros wear, signed.',
        price: 79900,
        rank: 3,
        featured: true,
        description:
          'A full-size Speed Flex authentic helmet, the same model worn on the field, hand-signed and certified.',
        features: [
          'Full-size Speed Flex authentic helmet',
          'Hand-signed on the shell',
          'Numbered Certificate of Authenticity',
          'Tamper-evident hologram sticker',
          'Premium display packaging',
        ],
        options: ['team', 'signer', 'inscription'],
      },
      {
        id: 'legacy-ink',
        name: 'Legacy Ink',
        helmetType: 'Custom Build',
        tagline: 'Built for you. Signed forever.',
        price: 129900,
        rank: 4,
        description:
          'A one-of-one helmet built to your spec: shell color, facemask, finish and personalization, then hand-signed and certified.',
        features: [
          'Full-size custom-built helmet',
          'You pick shell color, facemask and finish',
          'Optional name & number personalization',
          'Hand-signed on the shell',
          'Numbered Certificate of Authenticity',
          'Tamper-evident hologram sticker',
        ],
        options: ['shellColor', 'facemaskColor', 'finish', 'personalization', 'signer', 'inscription'],
      },
    ],

    // Choices for the custom (Legacy Ink) builder. `add` is the extra cost in cents.
    customOptions: {
      shellColor: [
        { id: 'white', label: 'White', hex: '#f4f4f2' },
        { id: 'black', label: 'Black', hex: '#1b1b1d' },
        { id: 'navy', label: 'Navy', hex: '#1a2456' },
        { id: 'red', label: 'Red', hex: '#b3261e' },
        { id: 'royal', label: 'Royal Blue', hex: '#1f4fbf' },
        { id: 'green', label: 'Green', hex: '#1f6b3a' },
        { id: 'gold', label: 'Metallic Gold', hex: '#b8962e', add: 7500 },
        { id: 'chrome', label: 'Chrome', hex: '#a9b0b8', add: 15000 },
      ],
      facemaskColor: [
        { id: 'grey', label: 'Grey', hex: '#8a8f96' },
        { id: 'black', label: 'Black', hex: '#1b1b1d' },
        { id: 'white', label: 'White', hex: '#f4f4f2' },
        { id: 'gold', label: 'Gold', hex: '#b8962e' },
      ],
      finish: [
        { id: 'gloss', label: 'Gloss' },
        { id: 'matte', label: 'Matte', add: 5000 },
      ],
      personalizationPrice: 7500,
    },
  };

  CATALOG.findTier = function (id) {
    return CATALOG.tiers.find((t) => t.id === id) || null;
  };

  CATALOG.findOption = function (group, id) {
    return (CATALOG.customOptions[group] || []).find((o) => o.id === id) || null;
  };

  /**
   * Price of one unit with its options. Used by both the browser and the
   * server, so the server can recompute the total itself.
   */
  CATALOG.unitPrice = function (tierId, options) {
    const tier = CATALOG.findTier(tierId);
    if (!tier) return null;
    let price = tier.price;
    if (tier.options.includes('shellColor')) {
      price += (CATALOG.findOption('shellColor', options.shellColor) || {}).add || 0;
      price += (CATALOG.findOption('finish', options.finish) || {}).add || 0;
      if (options.personalizationName || options.personalizationNumber) {
        price += CATALOG.customOptions.personalizationPrice;
      }
    }
    return price;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CATALOG;
  else root.CATALOG = CATALOG;
})(typeof window !== 'undefined' ? window : globalThis);
