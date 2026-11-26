/* ============================================================
   Store settings — edit these before going live.
   ============================================================ */
window.STORE_CONFIG = {
  // Shown in the header, page title and footer.
  storeName: 'Lid Ripper',

  // Where order requests and customer questions go.
  contactEmail: 'orders@example.com',

  // 'stripe'  → real checkout through Stripe (needs the Netlify function
  //             and the STRIPE_SECRET_KEY environment variable, see README).
  // 'request' → no payment taken; the customer sends an order request by
  //             email and you invoice them. Good for testing or a soft launch.
  checkoutMode: 'request',

  // Flat shipping charge in cents (shown in the cart; the server uses its own
  // copy in netlify/functions/create-checkout.js).
  shippingFlat: 2500,
};
