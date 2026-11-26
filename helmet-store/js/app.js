/* ============================================================
   Signed helmet store — app logic (no framework, hash routing)
   Routes: #/  #/tier/:id  #/cart  #/verify[/:serial]  #/success
   ============================================================ */
(function () {
  const CFG = window.STORE_CONFIG;
  const CAT = window.CATALOG;
  const app = document.getElementById('app');
  const CART_KEY = 'helmet-store-cart-v1';

  /* ---------- helpers ---------- */
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (cents) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: CAT.currency.toUpperCase() });

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------- helmet illustration ---------- */
  function helmetSVG({ shell = '#1a2456', mask = '#8a8f96', stripe = '#f4f4f2', matte = false, signed = true, label = '' } = {}) {
    const gid = 'g' + Math.random().toString(36).slice(2, 8);
    return `
<svg viewBox="0 0 220 170" role="img" aria-label="${esc(label || 'Signed football helmet')}">
  <defs>
    <radialGradient id="${gid}" cx="40%" cy="30%" r="75%">
      <stop offset="0" stop-color="#fff" stop-opacity="${matte ? 0.12 : 0.45}"/>
      <stop offset=".45" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="M28 108 C14 52 58 14 112 14 C162 14 192 50 190 92 L188 104 C187 112 180 116 172 116 L152 116 L144 140 L64 140 C46 140 33 130 28 108 Z" fill="${shell}"/>
  <path d="M28 108 C14 52 58 14 112 14 C162 14 192 50 190 92 L188 104 C187 112 180 116 172 116 L152 116 L144 140 L64 140 C46 140 33 130 28 108 Z" fill="url(#${gid})"/>
  <path d="M52 34 C86 10 146 10 178 44" fill="none" stroke="${stripe}" stroke-width="7" stroke-linecap="round" opacity=".9"/>
  <circle cx="98" cy="98" r="9" fill="rgba(0,0,0,.35)"/>
  <path d="M64 140 L144 140 L140 150 L70 150 Z" fill="rgba(0,0,0,.35)"/>
  <g fill="none" stroke="${mask}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M156 74 L206 82 L206 132 L150 138"/>
    <path d="M154 104 L206 106"/>
    <path d="M178 78 L178 136"/>
  </g>
  ${signed ? `<path d="M50 74 c6 -14 14 -12 12 0 s-6 12 4 4 s10 -14 14 -6 s2 10 10 2 s8 -8 12 -2 c3 4 8 2 14 -4" fill="none" stroke="${shell === '#1b1b1d' || shell === '#1a2456' ? '#e6e6e6' : '#111'}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>` : ''}
</svg>`;
  }

  const tierPreview = {
    'rookie-ink': { shell: '#b3261e', mask: '#8a8f96' },
    'starter-ink': { shell: '#1a2456', mask: '#8a8f96' },
    'franchise-ink': { shell: '#1b1b1d', mask: '#b8962e', stripe: '#b8962e' },
    'legacy-ink': { shell: '#b8962e', mask: '#1b1b1d', stripe: '#1b1b1d' },
  };

  function previewFor(tierId, options) {
    if (tierId === 'legacy-ink' && options) {
      const shell = CAT.findOption('shellColor', options.shellColor);
      const mask = CAT.findOption('facemaskColor', options.facemaskColor);
      return {
        shell: shell ? shell.hex : tierPreview[tierId].shell,
        mask: mask ? mask.hex : tierPreview[tierId].mask,
        stripe: shell && (shell.id === 'white' || shell.id === 'chrome') ? '#1b1b1d' : '#f4f4f2',
        matte: options.finish === 'matte',
      };
    }
    return tierPreview[tierId];
  }

  /* ---------- cart (localStorage, guarded) ---------- */
  function loadCart() {
    try {
      const v = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(v) ? v.filter((i) => CAT.findTier(i.tierId)) : [];
    } catch (e) {
      return [];
    }
  }
  let cart = loadCart();
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* storage blocked: cart lives in memory */ }
    updateCartCount();
  }
  function updateCartCount() {
    document.getElementById('cart-count').textContent = cart.reduce((n, i) => n + i.qty, 0);
  }
  function addToCart(tierId, options, qty) {
    const key = tierId + '|' + JSON.stringify(options);
    const existing = cart.find((i) => i.key === key);
    if (existing) existing.qty = Math.min(existing.qty + qty, 10);
    else cart.push({ key, tierId, options, qty });
    saveCart();
  }
  const cartSubtotal = () => cart.reduce((sum, i) => sum + CAT.unitPrice(i.tierId, i.options) * i.qty, 0);

  function describeOptions(tierId, o) {
    const parts = [];
    if (o.team) parts.push('Team: ' + o.team);
    if (o.shellColor) parts.push('Shell: ' + CAT.findOption('shellColor', o.shellColor).label);
    if (o.facemaskColor) parts.push('Facemask: ' + CAT.findOption('facemaskColor', o.facemaskColor).label);
    if (o.finish) parts.push('Finish: ' + CAT.findOption('finish', o.finish).label);
    if (o.personalizationName || o.personalizationNumber)
      parts.push('Personalized: ' + [o.personalizationName, o.personalizationNumber && '#' + o.personalizationNumber].filter(Boolean).join(' '));
    if (o.signer) parts.push('Signer: ' + o.signer);
    if (o.inscription) parts.push('Inscription: "' + o.inscription + '"');
    return parts;
  }

  /* ---------- views ---------- */
  function inkDots(rank) {
    return `<div class="ink-dots" aria-hidden="true">${[1, 2, 3, 4].map((n) => `<span class="${n <= rank ? 'on' : ''}"></span>`).join('')}</div>`;
  }

  function tierCard(t) {
    return `
      <a class="tier-card${t.featured ? ' featured' : ''}" href="#/tier/${t.id}">
        ${t.featured ? '<span class="tier-flag">Most popular</span>' : ''}
        <div class="tier-art" style="${t.id === 'rookie-ink' ? 'padding:22px' : ''}">${helmetSVG({ ...tierPreview[t.id], label: t.name + ' helmet' })}</div>
        ${inkDots(t.rank)}
        <div class="tier-type">${esc(t.helmetType)}</div>
        <div class="tier-name">${esc(t.name)}</div>
        <div class="tier-tagline">${esc(t.tagline)}</div>
        <div class="tier-price">${t.id === 'legacy-ink' ? '<small>from </small>' : ''}${money(t.price)}</div>
      </a>`;
  }

  function viewHome() {
    return `
      <section class="hero">
        <div>
          <span class="eyebrow">Hand-signed · Certified</span>
          <h1>Signed helmets,<br/>four ways to own one.</h1>
          <p class="lead">From a desk-sized mini to a one-of-one custom build, every helmet is hand-signed and ships with a numbered Certificate of Authenticity.</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#tiers">Shop the tiers</a>
            <a class="btn btn-ghost" href="#/verify">Verify a certificate</a>
          </div>
        </div>
        <div class="hero-art">${helmetSVG({ ...tierPreview['franchise-ink'], label: 'Signed Speed Flex helmet' })}</div>
      </section>

      <section class="section" id="tiers">
        <div class="section-head">
          <h2>Choose your tier</h2>
          <span class="coa-badge">✓ Every tier: on-helmet autograph + Certificate of Authenticity</span>
        </div>
        <div class="tiers">${CAT.tiers.map(tierCard).join('')}</div>
      </section>

      <section class="section">
        <div class="section-head"><h2>How authentication works</h2></div>
        <div class="steps">
          <div class="step"><h3>Signed in person</h3><p>Each helmet is signed by hand at a witnessed signing, never with an autopen or a stamp.</p></div>
          <div class="step"><h3>Hologram applied</h3><p>A tamper-evident hologram with a unique number goes on the helmet right after signing.</p></div>
          <div class="step"><h3>Numbered COA</h3><p>Your Certificate of Authenticity carries a serial number that matches the hologram.</p></div>
          <div class="step"><h3>Verify anytime</h3><p>Enter the serial on our <a href="#/verify">verification page</a> to confirm the record.</p></div>
        </div>
      </section>`;
  }

  function swatchGroup(name, label, list, selected) {
    return `
      <div class="opt-group">
        <label>${label}</label>
        <div class="swatches">
          ${list.map((o) => `
            <label class="swatch">
              <input type="radio" name="${name}" value="${o.id}" ${o.id === selected ? 'checked' : ''} />
              <span>${o.hex ? `<i style="background:${o.hex}"></i>` : ''}${esc(o.label)}${o.add ? ` <em class="muted">+${money(o.add)}</em>` : ''}</span>
            </label>`).join('')}
        </div>
      </div>`;
  }

  function viewTier(id) {
    const t = CAT.findTier(id);
    if (!t) return viewNotFound();
    const co = CAT.customOptions;
    const isCustom = t.options.includes('shellColor');
    const defaults = isCustom ? { shellColor: 'navy', facemaskColor: 'grey', finish: 'gloss' } : null;

    const fields = [];
    if (isCustom) {
      fields.push(swatchGroup('shellColor', 'Shell color', co.shellColor, defaults.shellColor));
      fields.push(swatchGroup('facemaskColor', 'Facemask color', co.facemaskColor, defaults.facemaskColor));
      fields.push(swatchGroup('finish', 'Finish', co.finish, defaults.finish));
      fields.push(`
        <div class="opt-group">
          <label>Personalization <span class="muted">(optional, +${money(co.personalizationPrice)})</span></label>
          <div class="row-2">
            <input type="text" name="personalizationName" maxlength="16" placeholder="Name on back" />
            <input type="text" name="personalizationNumber" maxlength="2" inputmode="numeric" pattern="[0-9]{1,2}" placeholder="Number" />
          </div>
        </div>`);
    }
    if (t.options.includes('team')) {
      fields.push(`
        <div class="field">
          <label for="f-team">Team / colorway</label>
          <input id="f-team" type="text" name="team" maxlength="60" required placeholder="e.g. your favorite team" />
        </div>`);
    }
    fields.push(`
      <div class="field">
        <label for="f-signer">Who should sign it?</label>
        <input id="f-signer" type="text" name="signer" maxlength="60" required placeholder="Player name" />
        <div class="hint">We confirm signer availability before your helmet is signed. If they're unavailable we'll offer an alternative or a full refund.</div>
      </div>
      <div class="field">
        <label for="f-inscription">Inscription <span class="muted">(optional)</span></label>
        <input id="f-inscription" type="text" name="inscription" maxlength="40" placeholder="e.g. a stat, year or short message" />
      </div>`);

    return `
      <a class="back" href="#/">← All tiers</a>
      <div class="product">
        <div class="product-art${t.id === 'rookie-ink' ? ' mini' : ''}" id="product-art">${helmetSVG({ ...previewFor(t.id, defaults), label: t.name + ' helmet' })}</div>
        <div>
          ${inkDots(t.rank)}
          <div class="tier-type">${esc(t.helmetType)}</div>
          <h1 style="margin-bottom:.15em">${esc(t.name)}</h1>
          <p class="muted">${esc(t.tagline)}</p>
          <div class="price-big" id="price">${money(CAT.unitPrice(t.id, defaults || {}))}</div>
          <p>${esc(t.description)}</p>
          <ul class="features">${t.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
          <form class="panel" id="add-form" novalidate>
            ${fields.join('')}
            <div class="add-row">
              <div>
                <label for="f-qty">Qty</label>
                <input id="f-qty" class="qty" type="number" name="qty" min="1" max="10" value="1" />
              </div>
              <button class="btn btn-primary btn-block" type="submit">Add to cart</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function readOptions(form, tier) {
    const fd = new FormData(form);
    const o = {};
    const keys = ['team', 'signer', 'inscription', 'shellColor', 'facemaskColor', 'finish', 'personalizationName', 'personalizationNumber'];
    keys.forEach((k) => {
      const v = (fd.get(k) || '').toString().trim();
      if (v) o[k] = v;
    });
    if (!tier.options.includes('shellColor')) {
      delete o.shellColor; delete o.facemaskColor; delete o.finish; delete o.personalizationName; delete o.personalizationNumber;
    }
    return o;
  }

  function bindTier(id) {
    const t = CAT.findTier(id);
    const form = document.getElementById('add-form');
    if (!form) return;
    const refresh = () => {
      const o = readOptions(form, t);
      document.getElementById('price').textContent = money(CAT.unitPrice(t.id, o));
      if (t.options.includes('shellColor')) {
        document.getElementById('product-art').innerHTML = helmetSVG({ ...previewFor(t.id, o), label: t.name + ' helmet' });
      }
    };
    form.addEventListener('input', refresh);
    form.addEventListener('change', refresh);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const num = form.querySelector('[name=personalizationNumber]');
      if (num && num.value && !/^[0-9]{1,2}$/.test(num.value)) {
        num.focus();
        return toast('Number must be 1–2 digits.');
      }
      const missing = [...form.querySelectorAll('[required]')].find((el) => !el.value.trim());
      if (missing) {
        missing.focus();
        return toast('Please fill in: ' + form.querySelector(`label[for="${missing.id}"]`).textContent.trim());
      }
      const qty = Math.max(1, Math.min(10, parseInt(form.qty.value, 10) || 1));
      addToCart(t.id, readOptions(form, t), qty);
      toast(`${t.name} added to cart`);
      location.hash = '#/cart';
    });
  }

  function viewCart() {
    if (!cart.length) {
      return `<div class="empty"><h2>Your cart is empty</h2><p class="muted">Pick a tier to get started.</p><a class="btn btn-primary" href="#/">Shop helmets</a></div>`;
    }
    const sub = cartSubtotal();
    const ship = CFG.shippingFlat;
    const items = cart.map((i, idx) => {
      const t = CAT.findTier(i.tierId);
      const unit = CAT.unitPrice(i.tierId, i.options);
      return `
        <div class="cart-item">
          <div class="cart-thumb">${helmetSVG({ ...previewFor(i.tierId, i.options), signed: false, label: t.name })}</div>
          <div>
            <h3>${esc(t.name)}</h3>
            <div class="tier-type">${esc(t.helmetType)}</div>
            <div class="cart-opts">${describeOptions(i.tierId, i.options).map(esc).join('<br/>')}</div>
          </div>
          <div class="cart-right">
            <strong>${money(unit * i.qty)}</strong>
            <input type="number" min="1" max="10" value="${i.qty}" data-qty="${idx}" aria-label="Quantity" />
            <button class="link-btn" data-remove="${idx}">Remove</button>
          </div>
        </div>`;
    }).join('');

    const request = CFG.checkoutMode !== 'stripe';
    return `
      <h1 style="margin-top:24px">Cart</h1>
      <div class="cart-layout">
        <div class="panel">${items}</div>
        <div class="panel">
          <h3>Order summary</h3>
          <table class="totals">
            <tr><td>Subtotal</td><td>${money(sub)}</td></tr>
            <tr><td>Insured shipping</td><td>${money(ship)}</td></tr>
            <tr class="grand"><td>Total</td><td>${money(sub + ship)}</td></tr>
          </table>
          <span class="coa-badge" style="margin-bottom:16px">✓ COA included with every helmet</span>
          ${request ? requestForm() : `<button class="btn btn-primary btn-block" id="checkout-btn">Checkout securely</button><p class="hint" style="text-align:center">Payments are processed by Stripe.</p>`}
        </div>
      </div>`;
  }

  function requestForm() {
    return `
      <div class="notice">Send us your order and we'll confirm signer availability and email you an invoice. You won't be charged until then.</div>
      <form id="request-form">
        <input type="text" name="bot-field" hidden tabindex="-1" autocomplete="off" />
        <div class="field"><label for="r-name">Full name</label><input id="r-name" type="text" name="name" required autocomplete="name" /></div>
        <div class="row-2">
          <div class="field"><label for="r-email">Email</label><input id="r-email" type="email" name="email" required autocomplete="email" /></div>
          <div class="field"><label for="r-phone">Phone</label><input id="r-phone" type="tel" name="phone" autocomplete="tel" /></div>
        </div>
        <div class="field"><label for="r-address">Shipping address</label><textarea id="r-address" name="address" required autocomplete="street-address"></textarea></div>
        <div class="field"><label for="r-notes">Notes <span class="muted">(optional)</span></label><textarea id="r-notes" name="notes"></textarea></div>
        <button class="btn btn-primary btn-block" type="submit">Send order request</button>
      </form>`;
  }

  function orderText() {
    return cart.map((i, n) => {
      const t = CAT.findTier(i.tierId);
      return `${n + 1}. ${t.name} (${t.helmetType}) x${i.qty} — ${money(CAT.unitPrice(i.tierId, i.options) * i.qty)}\n   ${describeOptions(i.tierId, i.options).join('\n   ')}`;
    }).join('\n') + `\nShipping: ${money(CFG.shippingFlat)}\nTotal: ${money(cartSubtotal() + CFG.shippingFlat)}`;
  }

  function bindCart() {
    app.querySelectorAll('[data-qty]').forEach((el) =>
      el.addEventListener('change', () => {
        const i = cart[+el.dataset.qty];
        i.qty = Math.max(1, Math.min(10, parseInt(el.value, 10) || 1));
        saveCart();
        render();
      }));
    app.querySelectorAll('[data-remove]').forEach((el) =>
      el.addEventListener('click', () => {
        cart.splice(+el.dataset.remove, 1);
        saveCart();
        render();
      }));

    const btn = document.getElementById('checkout-btn');
    if (btn) btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Redirecting…';
      try {
        const res = await fetch('/.netlify/functions/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: cart.map(({ tierId, options, qty }) => ({ tierId, options, qty })) }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || 'Checkout failed');
        location.href = data.url;
      } catch (err) {
        toast(err.message || 'Checkout is unavailable right now.');
        btn.disabled = false;
        btn.textContent = 'Checkout securely';
      }
    });

    const form = document.getElementById('request-form');
    if (form) form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const order = orderText();
      const body = new URLSearchParams({ 'form-name': 'order-request', order, total: money(cartSubtotal() + CFG.shippingFlat) });
      for (const [k, v] of fd.entries()) body.append(k, v);
      const submit = form.querySelector('button[type=submit]');
      submit.disabled = true;
      let sent = false;
      try {
        const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
        sent = res.ok;
      } catch (err) { /* fall through to email */ }
      if (!sent) {
        // Not on Netlify (e.g. local preview): hand the order to the customer's email app instead.
        const text = `Name: ${fd.get('name')}\nEmail: ${fd.get('email')}\nPhone: ${fd.get('phone') || ''}\nShip to:\n${fd.get('address')}\n\nNotes: ${fd.get('notes') || ''}\n\n${order}`;
        location.href = `mailto:${CFG.contactEmail}?subject=${encodeURIComponent('Helmet order request')}&body=${encodeURIComponent(text)}`;
      }
      cart = [];
      saveCart();
      location.hash = '#/success/request';
    });
  }

  function viewSuccess(kind) {
    if (kind !== 'request') { cart = []; saveCart(); }
    return `
      <div class="empty">
        <span class="coa-badge">✓ ${kind === 'request' ? 'Request received' : 'Order confirmed'}</span>
        <h1 style="margin-top:16px">Thank you!</h1>
        <p class="muted">${kind === 'request'
          ? "We'll confirm signer availability and email you an invoice shortly."
          : "Your payment went through. We'll email you when your helmet has been signed, with its COA serial number."}</p>
        <a class="btn btn-ghost" href="#/">Back to shop</a>
      </div>`;
  }

  let certCache = null;
  async function loadCerts() {
    if (!certCache) {
      const res = await fetch('./data/certificates.json', { cache: 'no-cache' });
      certCache = await res.json();
    }
    return certCache;
  }

  function viewVerify(serial) {
    return `
      <div class="verify">
        <span class="eyebrow">Certificate of Authenticity</span>
        <h1>Verify a COA</h1>
        <p class="muted">Enter the serial number printed on your certificate. It matches the hologram on your helmet.</p>
        <form class="verify-form" id="verify-form">
          <input type="text" name="serial" placeholder="e.g. SHC-DEMO-0001" value="${esc(serial || '')}" required aria-label="Serial number" />
          <button class="btn btn-primary" type="submit">Verify</button>
        </form>
        <div id="verify-result"></div>
      </div>`;
  }

  async function bindVerify(serial) {
    const form = document.getElementById('verify-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = form.serial.value.trim().toUpperCase();
      if (v) location.hash = '#/verify/' + encodeURIComponent(v);
    });
    if (!serial) return;
    const out = document.getElementById('verify-result');
    out.innerHTML = '<p class="muted">Checking…</p>';
    try {
      const certs = await loadCerts();
      const c = certs.find((x) => x.serial.toUpperCase() === serial.toUpperCase());
      if (!c) {
        out.innerHTML = `<div class="cert"><div class="cert-head bad">✕ No certificate found for ${esc(serial)}</div><dl><dt>What now?</dt><dd>Check the serial for typos, or <a href="mailto:${esc(CFG.contactEmail)}">contact us</a> and we'll look into it.</dd></dl></div>`;
        return;
      }
      const t = CAT.findTier(c.tier);
      out.innerHTML = `
        <div class="cert">
          <div class="cert-head ok">✓ Authentic: certificate ${esc(c.serial)} is on record</div>
          <dl>
            <dt>Tier</dt><dd>${esc(t ? t.name : c.tier)}</dd>
            <dt>Item</dt><dd>${esc(c.item)}</dd>
            <dt>Signed by</dt><dd>${esc(c.signer)}</dd>
            ${c.inscription ? `<dt>Inscription</dt><dd>${esc(c.inscription)}</dd>` : ''}
            <dt>Signed on</dt><dd>${esc(c.signedOn)}</dd>
            <dt>Witnessed</dt><dd>${esc(c.witness)}</dd>
            <dt>Hologram #</dt><dd>${esc(c.hologram)}</dd>
          </dl>
        </div>`;
    } catch (err) {
      out.innerHTML = '<p class="muted">Verification is unavailable right now. Please try again.</p>';
    }
  }

  function viewNotFound() {
    return `<div class="empty"><h2>Page not found</h2><a class="btn btn-ghost" href="#/">Back to shop</a></div>`;
  }

  /* ---------- router ---------- */
  function render() {
    const hash = location.hash || '#/';
    if (hash === '#tiers') {
      // in-page anchor from the hero button
      if (!document.getElementById('tiers')) { app.innerHTML = viewHome(); }
      document.getElementById('tiers').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const [, route, param] = hash.replace(/^#\/?/, '/').split('/');
    let nav = 'home';
    switch (route) {
      case '':
      case undefined:
        app.innerHTML = viewHome(); break;
      case 'tier':
        app.innerHTML = viewTier(param); bindTier(param); break;
      case 'cart':
        nav = 'cart'; app.innerHTML = viewCart(); bindCart(); break;
      case 'verify':
        nav = 'verify'; app.innerHTML = viewVerify(param && decodeURIComponent(param)); bindVerify(param && decodeURIComponent(param)); break;
      case 'success':
        app.innerHTML = viewSuccess(param); break;
      default:
        app.innerHTML = viewNotFound();
    }
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
    window.scrollTo(0, 0);
  }

  /* ---------- boot ---------- */
  document.title = CFG.storeName + ' · Signed Football Helmets';
  document.querySelectorAll('[data-store-name]').forEach((el) => (el.textContent = CFG.storeName));
  document.getElementById('year').textContent = new Date().getFullYear();
  document.getElementById('contact-link').href = 'mailto:' + CFG.contactEmail;
  updateCartCount();
  window.addEventListener('hashchange', render);
  render();
})();
