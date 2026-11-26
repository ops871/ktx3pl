# Signed Football Helmet Store

A standalone storefront for hand-signed football helmets. It's separate from the
KTX 3PL warehouse tracker in the repo root: it shares no code with it and deploys as its own site.

Every helmet includes an on-helmet autograph and a numbered Certificate of Authenticity (COA).

| Tier | Helmet | Placeholder price |
|---|---|---|
| **Rookie Ink** | Mini helmet | $149 |
| **Starter Ink** | Full-size replica | $399 |
| **Franchise Ink** | Speed Flex authentic | $799 |
| **Legacy Ink** | Custom build (shell, facemask, finish, name/number) | from $1,299 |

## What's in it

- **Shop.** Tier cards, a product page per tier, and a live helmet preview for the custom builder.
- **Cart.** Saved in the browser. Customers can change quantities or remove items.
- **Checkout.** Has two modes, set in `js/config.js`:
  - `request` (default): the customer submits an order request and you invoice them. Requests
    show up in **Netlify → Forms → order-request**, where you can turn on email notifications.
  - `stripe`: real card checkout through Stripe Checkout, with insured shipping and address collection.
- **Verify COA** (`#/verify`). Customers enter their COA serial to confirm it's on record.
- **Installable PWA.** Works offline for browsing.

## Files

```
helmet-store/
├── index.html
├── css/styles.css
├── js/
│   ├── config.js        ← store name, contact email, checkout mode, shipping
│   ├── catalog.js       ← tiers, prices, custom options (used by browser AND server)
│   └── app.js
├── data/certificates.json  ← COA records for the verify page
├── netlify/functions/create-checkout.js  ← Stripe checkout (server side)
├── netlify.toml
├── manifest.json, service-worker.js, icons/
```

## Deploy (Netlify)

1. In Netlify, choose **Add new site → Import an existing project** and pick this repo.
2. Set **Base directory** to `helmet-store`. Leave the build command empty.
3. Deploy. Order requests will appear under **Forms**.

## Going live checklist

- [ ] `js/config.js`: set `storeName` and `contactEmail`.
- [ ] `js/catalog.js`: set real prices (in cents) and edit descriptions and features.
- [ ] To take card payments:
  1. In Netlify, go to **Site settings → Environment variables** and add `STRIPE_SECRET_KEY`.
     Use your `sk_test_...` key first, then `sk_live_...`.
  2. Set `checkoutMode: 'stripe'` in `js/config.js`.
  3. If you change shipping, update it in both `js/config.js` and `create-checkout.js`.
- [ ] Replace the demo record in `data/certificates.json` with your real COAs, one per signed helmet.
- [ ] Bump `VERSION` in `service-worker.js` whenever you change files.

### Adding a certificate

Add an entry to `data/certificates.json` and redeploy:

```json
{
  "serial": "SHC-000123",
  "tier": "starter-ink",
  "item": "Full-Size Replica Helmet",
  "signer": "Player Name",
  "inscription": "Optional",
  "signedOn": "2026-12-01",
  "witness": "In-person private signing",
  "hologram": "HX-000123"
}
```

Once you have more than a few hundred certificates, move them into a database
(for example Supabase, like the warehouse tracker) so you can add them without a redeploy.

## Run locally

```
cd helmet-store
python3 -m http.server 8000
```

Then open http://localhost:8000. Locally, "Send order request" falls back to opening an email,
and Stripe checkout needs `netlify dev` to run the function.

## Notes

- "Speed Flex" is a Riddell trademark. Describe genuine Riddell SpeedFlex helmets accurately,
  and keep your own tier names (above) as the brand.
- Team logos are licensed marks. Sell licensed helmets, and don't add team logos to the site art
  without permission.
