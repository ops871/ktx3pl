# Lid Ripper

A standalone storefront for hand-signed football helmets. It's separate from the
KTX 3PL warehouse tracker in the repo root: it shares no code with it and deploys as its own site.

Every helmet is a **random draw**: the customer picks a tier, and the team and signer
(plus the design, for Grail Rip) are a surprise. Every helmet includes an on-helmet
autograph and a numbered Certificate of Authenticity (COA).

| Tier | Helmet | Placeholder price |
|---|---|---|
| **Blaster Rip** | Mini helmet | $149 |
| **Hobby Rip** | Full-size replica | $399 |
| **Chase Rip** | Speed Flex authentic | $799 |
| **Grail Rip** | One-of-one hand-painted USA theme (random signer, no team) | $1,299 |

## What's in it

- **Shop.** Tier cards and a product page per tier. Customers choose only the tier and quantity.
- **Cart.** Saved in the browser. Customers can change quantities or remove items.
- **Checkout.** Has two modes, set in `js/config.js`:
  - `request` (default): the customer submits an order request and you invoice them. Requests
    show up in **Netlify → Forms → order-request**, where you can turn on email notifications.
  - `stripe`: real card checkout through Stripe Checkout, with insured shipping and address collection.
- **Ship it or sell it** (`#/rips`, "My Rips"). Customers sign in with their order code + email,
  see each helmet once you reveal it, then choose **Ship it** (confirm address) or **Sell it back**
  for your buyback offer (paid by PayPal, Venmo, Zelle or Cash App). The choice is final.
- **Admin** (`#/admin`, not linked in the menu). Create orders for invoiced customers, reveal each
  pull (team, signer, COA serial, buyback offer), then mark helmets shipped or payouts paid.
- **Verify COA** (`#/verify`). Checks revealed helmets automatically, plus anything in
  `data/certificates.json`.
- **Installable PWA.** Works offline for browsing.

## Files

```
helmet-store/
├── index.html
├── css/styles.css
├── js/
│   ├── config.js        ← store name, contact email, checkout mode, shipping
│   ├── catalog.js       ← tiers and prices (used by browser AND server)
│   └── app.js
├── data/certificates.json  ← COA records for the verify page
├── js/rips.js           ← My Rips + Admin pages
├── netlify/functions/
│   ├── create-checkout.js  ← starts Stripe checkout
│   ├── stripe-webhook.js   ← creates the order + rips after payment
│   ├── rips.js             ← customer: look up rips, ship or sell
│   ├── admin.js            ← owner: create orders, reveal, mark shipped/paid
│   ├── verify.js           ← COA lookup for revealed helmets
│   └── lib/rips.js         ← shared data code (Netlify Blobs)
├── package.json            ← @netlify/blobs (installed by Netlify)
├── netlify.toml
├── manifest.json, service-worker.js, icons/
```

## Deploy (Netlify)

1. In Netlify, choose **Add new site → Import an existing project** and pick this repo.
2. Set **Base directory** to `helmet-store`. Leave the build command empty.
3. Deploy. Order requests will appear under **Forms**.

## How a rip works

1. **Customer pays.** Stripe orders appear automatically (via the webhook). For order-request
   customers, create the order on `#/admin` after their invoice is paid and email them the code.
2. **You reveal.** On `#/admin` → "To reveal", enter the team, signer, COA serial and buyback
   offer (defaults to 70% of the tier price; change with the `BUYBACK_PERCENT` env variable).
3. **Customer chooses** on My Rips: ship it or sell it back.
4. **You finish.** "To ship" shows the address: ship it and enter tracking. "To pay" shows the
   payout account: send the money and click Mark paid.

## Going live checklist

- [ ] `js/config.js`: set `storeName` and `contactEmail`.
- [ ] `js/catalog.js`: set real prices (in cents) and edit descriptions and features.
- [ ] To take card payments:
  1. In Netlify, go to **Site settings → Environment variables** and add `STRIPE_SECRET_KEY`.
     Use your `sk_test_...` key first, then `sk_live_...`.
  2. Set `checkoutMode: 'stripe'` in `js/config.js`.
  3. If you change shipping, update it in both `js/config.js` and `create-checkout.js`.
- [ ] In Netlify environment variables, set `ADMIN_TOKEN` to a long random password
      (at least 12 characters). That's what you type to sign in at `#/admin`.
- [ ] For Stripe orders: in Stripe → Developers → Webhooks, add an endpoint
      `https://YOUR-SITE/.netlify/functions/stripe-webhook` for `checkout.session.completed`,
      and put its signing secret in Netlify as `STRIPE_WEBHOOK_SECRET`.
- [ ] Optional: set `BUYBACK_PERCENT` (default 70).
- [ ] Replace the demo record in `data/certificates.json` with your real COAs, one per signed helmet.
- [ ] Bump `VERSION` in `service-worker.js` whenever you change files.

### Adding a certificate

Add an entry to `data/certificates.json` and redeploy:

```json
{
  "serial": "LR-000123",
  "tier": "hobby-rip",
  "item": "Full-Size Replica Helmet",
  "signer": "Player Name",
  "inscription": "Optional",
  "signedOn": "2026-12-01",
  "witness": "In-person private signing",
  "hologram": "HX-000123"
}
```

You usually won't need this file: helmets revealed on the admin page are verifiable automatically.

## Run locally

```
cd helmet-store
python3 -m http.server 8000
```

Then open http://localhost:8000. Locally, "Send order request" falls back to opening an email.
Checkout, My Rips and Admin need the functions, so run `npm install && npx netlify dev` for those.

## Notes

- Random/mystery sales: some states regulate "mystery box" style sales. Have a lawyer check
  your terms (e.g. whether you list the possible teams/signers, your return policy, and how
  buyback offers are set).
- "Speed Flex" is a Riddell trademark. Describe genuine Riddell SpeedFlex helmets accurately,
  and keep your own tier names (above) as the brand.
- Team logos are licensed marks. Sell licensed helmets, and don't add team logos to the site art
  without permission.
