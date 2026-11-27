/* ============================================================
   "My Rips" (customer) and "Admin" (owner) pages.
   Customers: look up an order with order code + email, see each revealed
   helmet, then choose SHIP IT or SELL IT BACK.
   Admin (#/admin): create orders, reveal pulls, mark shipped / paid.
   ============================================================ */
(function () {
  const { esc, money, toast, helmetSVG, previewFor, CFG, CAT } = window.LR;
  const teamText = (rev) => rev.team || 'USA custom paint';
  const LAST_ORDER_KEY = 'lid-ripper-last-order';
  const ADMIN_TOKEN_KEY = 'lid-ripper-admin-token';

  const PAYOUT_LABELS = { paypal: 'PayPal', venmo: 'Venmo', zelle: 'Zelle', cashapp: 'Cash App' };
  const STATUS = {
    awaiting_reveal: ['Being revealed', 'pending'],
    revealed: ['Ready: ship or sell', 'action'],
    ship_requested: ['Shipping soon', 'pending'],
    shipped: ['Shipped', 'done'],
    sell_requested: ['Payout pending', 'pending'],
    paid: ['Sold & paid', 'done'],
  };
  const chip = (status) => {
    const [label, kind] = STATUS[status] || [status, 'pending'];
    return `<span class="chip chip-${kind}">${esc(label)}</span>`;
  };

  // Browser storage is a convenience only; it can be blocked.
  const store = (area) => ({
    get(k) { try { return JSON.parse(window[area].getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { window[area].setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del(k) { try { window[area].removeItem(k); } catch (e) { /* ignore */ } },
  });
  const local = store('localStorage');
  const session = store('sessionStorage');

  async function api(fn, payload, token) {
    let res;
    try {
      res = await fetch('/.netlify/functions/' + fn, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      throw new Error('Could not reach the server. Check your connection and try again.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: res.status });
    return data;
  }

  /* ============================== MY RIPS ============================== */
  let current = null; // { code, email, rips, defaultShipTo }

  function viewRips(codeFromUrl) {
    const last = local.get(LAST_ORDER_KEY) || {};
    const code = codeFromUrl || last.code || '';
    const email = last.email || '';
    return `
      <div class="rips-page">
        <span class="eyebrow">My Rips</span>
        <h1>See your pulls</h1>
        <p class="muted">Enter the order code from your confirmation and the email you ordered with. Once a helmet is revealed you can <strong>ship it</strong> home or <strong>sell it back</strong> to us.</p>
        <form class="panel lookup-form" id="lookup-form">
          <div class="row-2">
            <div class="field"><label for="l-code">Order code</label><input id="l-code" type="text" name="code" required placeholder="LR-XXXXXXXX" value="${esc(code)}" autocomplete="off" /></div>
            <div class="field"><label for="l-email">Email</label><input id="l-email" type="email" name="email" required value="${esc(email)}" autocomplete="email" /></div>
          </div>
          <button class="btn btn-primary" type="submit">Show my rips</button>
        </form>
        <div id="rips-out"></div>
      </div>`;
  }

  function ripCard(r) {
    const tier = CAT.findTier(r.tierId);
    const rev = r.reveal;
    const art = helmetSVG({ ...previewFor(r.tierId), signed: !!rev, label: r.tierName });
    let body = '';

    if (r.status === 'awaiting_reveal') {
      body = `<p class="muted">Your ${esc(r.tierName)} is being pulled and authenticated. Check back soon: we'll reveal the team and signer here.</p>`;
    } else {
      body = `
        <dl class="reveal">
          ${rev.team ? `<dt>Team</dt><dd>${esc(rev.team)}</dd>` : `<dt>Paint</dt><dd>USA custom, one of one</dd>`}
          <dt>Signed by</dt><dd>${esc(rev.signer)}</dd>
          <dt>Helmet</dt><dd>${esc(rev.item)}</dd>
          <dt>COA</dt><dd><a href="#/verify/${encodeURIComponent(rev.coaSerial)}">${esc(rev.coaSerial)}</a></dd>
        </dl>`;
      if (r.status === 'revealed') {
        body += `
          <div class="choice-actions">
            <button class="btn btn-primary" data-choose="ship" data-rip="${esc(r.id)}">📦 Ship it to me</button>
            <button class="btn btn-ghost" data-choose="sell" data-rip="${esc(r.id)}">💵 Sell it back for ${money(rev.buyback)}</button>
          </div>
          <div class="choice-form" id="choice-${esc(r.id)}"></div>`;
      } else if (r.status === 'ship_requested' || r.status === 'shipped') {
        body += `<p class="muted"><strong>Shipping to:</strong><br/>${esc(r.shipTo).replace(/\n/g, '<br/>')}</p>`;
        if (r.tracking) body += `<p><strong>Tracking:</strong> ${esc(r.tracking)}</p>`;
      } else if (r.status === 'sell_requested' || r.status === 'paid') {
        body += `<p class="muted">Sold back for <strong>${money(rev.buyback)}</strong>, paid via ${esc(PAYOUT_LABELS[r.payout.method] || r.payout.method)}.${r.status === 'sell_requested' ? ' Payouts are usually sent within 2 business days.' : ''}</p>`;
      }
    }

    return `
      <article class="rip-card">
        <div class="rip-art${r.status === 'awaiting_reveal' ? ' mystery' : ''}">${art}${r.status === 'awaiting_reveal' ? '<span class="q">?</span>' : ''}</div>
        <div class="rip-body">
          <div class="rip-head">
            <div><div class="tier-type">${esc(tier ? tier.helmetType : r.helmetType)}</div><h3>${esc(r.tierName)}</h3></div>
            ${chip(r.status)}
          </div>
          ${body}
        </div>
      </article>`;
  }

  function renderRips() {
    const out = document.getElementById('rips-out');
    if (!current) { out.innerHTML = ''; return; }
    const open = current.rips.filter((r) => r.status === 'revealed').length;
    out.innerHTML = `
      <div class="rips-summary">
        <h2>Order ${esc(current.code)}</h2>
        <p class="muted">${current.rips.length} helmet${current.rips.length === 1 ? '' : 's'}${open ? ` · <strong>${open} waiting on your choice</strong>` : ''}</p>
      </div>
      <div class="rip-list">${current.rips.map(ripCard).join('')}</div>`;
  }

  function showChoiceForm(ripId, kind) {
    const r = current.rips.find((x) => x.id === ripId);
    const box = document.getElementById('choice-' + ripId);
    if (!r || !box) return;
    box.innerHTML = kind === 'ship'
      ? `
        <form data-confirm="ship" data-rip="${esc(ripId)}">
          <div class="field"><label for="ship-${esc(ripId)}">Ship to</label>
            <textarea id="ship-${esc(ripId)}" name="shipTo" required autocomplete="street-address" placeholder="Name, street, city, state, ZIP">${esc(current.defaultShipTo || '')}</textarea></div>
          <p class="hint">Ships insured with its Certificate of Authenticity. This choice is final.</p>
          <button class="btn btn-primary" type="submit">Confirm shipping</button>
          <button class="link-btn" type="button" data-cancel="${esc(ripId)}">Cancel</button>
        </form>`
      : `
        <form data-confirm="sell" data-rip="${esc(ripId)}">
          <p>We'll buy this helmet back for <strong>${money(r.reveal.buyback)}</strong>.</p>
          <div class="row-2">
            <div class="field"><label for="m-${esc(ripId)}">Pay me with</label>
              <select id="m-${esc(ripId)}" name="method" required>
                ${Object.entries(PAYOUT_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
              </select></div>
            <div class="field"><label for="h-${esc(ripId)}">Account (email, phone or @handle)</label>
              <input id="h-${esc(ripId)}" type="text" name="handle" required /></div>
          </div>
          <p class="hint">The helmet stays with us and you get paid instead. This choice is final.</p>
          <button class="btn btn-primary" type="submit">Sell it for ${money(r.reveal.buyback)}</button>
          <button class="link-btn" type="button" data-cancel="${esc(ripId)}">Cancel</button>
        </form>`;
    const first = box.querySelector('textarea, select');
    if (first) first.focus();
  }

  async function lookup(code, email) {
    const out = document.getElementById('rips-out');
    out.innerHTML = '<p class="muted">Loading your rips…</p>';
    try {
      const data = await api('rips', { action: 'lookup', code, email });
      current = { code: data.code, email, rips: data.rips, defaultShipTo: data.defaultShipTo };
      local.set(LAST_ORDER_KEY, { code: data.code, email });
      renderRips();
    } catch (err) {
      current = null;
      out.innerHTML = `<div class="notice">${esc(err.message)}</div>`;
    }
  }

  function bindRips(codeFromUrl) {
    current = null;
    const form = document.getElementById('lookup-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      lookup(form.code.value.trim().toUpperCase(), form.email.value.trim());
    });
    if (codeFromUrl && form.email.value) lookup(codeFromUrl.toUpperCase(), form.email.value.trim());

    const out = document.getElementById('rips-out');
    out.addEventListener('click', (e) => {
      const choose = e.target.closest('[data-choose]');
      if (choose) return showChoiceForm(choose.dataset.rip, choose.dataset.choose);
      const cancel = e.target.closest('[data-cancel]');
      if (cancel) document.getElementById('choice-' + cancel.dataset.cancel).innerHTML = '';
    });
    out.addEventListener('submit', async (e) => {
      const f = e.target.closest('form[data-confirm]');
      if (!f) return;
      e.preventDefault();
      if (!f.reportValidity()) return;
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      const payload = { action: f.dataset.confirm, code: current.code, email: current.email, ripId: f.dataset.rip };
      if (f.dataset.confirm === 'ship') payload.shipTo = f.shipTo.value;
      else { payload.method = f.method.value; payload.handle = f.handle.value; }
      try {
        const { rip } = await api('rips', payload);
        current.rips = current.rips.map((r) => (r.id === rip.id ? rip : r));
        renderRips();
        toast(f.dataset.confirm === 'ship' ? 'Got it, we’ll ship it to you.' : 'Sold! Your payout is on the way.');
      } catch (err) {
        toast(err.message);
        btn.disabled = false;
      }
    });
  }

  /* ============================== ADMIN ============================== */
  let adminRips = [];
  let adminFilter = 'open';

  function viewAdmin() {
    const token = session.get(ADMIN_TOKEN_KEY);
    if (!token) {
      return `
        <div class="rips-page">
          <span class="eyebrow">Admin</span>
          <h1>Sign in</h1>
          <form class="panel" id="token-form">
            <div class="field"><label for="a-token">Admin token</label><input id="a-token" type="password" name="token" required autocomplete="current-password" /></div>
            <p class="hint">The ADMIN_TOKEN you set in Netlify. It's kept only for this browser tab.</p>
            <button class="btn btn-primary" type="submit">Sign in</button>
          </form>
        </div>`;
    }
    return `
      <div class="admin-page">
        <div class="rip-head" style="margin-top:24px">
          <h1 style="margin:0">Admin</h1>
          <button class="btn btn-ghost" id="sign-out">Sign out</button>
        </div>

        <details class="panel" id="create-panel">
          <summary><strong>Create an order</strong> <span class="muted">(for invoiced / order-request customers)</span></summary>
          <form id="create-form" style="margin-top:16px">
            <div class="row-2">
              <div class="field"><label for="c-email">Customer email</label><input id="c-email" type="email" name="email" required /></div>
              <div class="field"><label for="c-ship">Ship-to address <span class="muted">(optional)</span></label><textarea id="c-ship" name="shipTo" style="min-height:44px"></textarea></div>
            </div>
            <div class="qty-grid">
              ${CAT.tiers.map((t) => `<div class="field"><label for="c-${t.id}">${esc(t.name)}</label><input id="c-${t.id}" type="number" min="0" max="50" value="0" data-tier="${t.id}" /></div>`).join('')}
            </div>
            <button class="btn btn-primary" type="submit">Create order</button>
            <div id="create-out"></div>
          </form>
        </details>

        <div class="tabs" role="tablist">
          ${[['open', 'Needs action'], ['awaiting_reveal', 'To reveal'], ['ship_requested', 'To ship'], ['sell_requested', 'To pay'], ['all', 'All']]
            .map(([k, v]) => `<button class="tab${adminFilter === k ? ' active' : ''}" data-filter="${k}">${v} <span class="count" data-count="${k}"></span></button>`).join('')}
        </div>
        <div id="admin-list"><p class="muted">Loading…</p></div>
      </div>`;
  }

  const matches = (r, f) =>
    f === 'all' ? true : f === 'open' ? ['awaiting_reveal', 'ship_requested', 'sell_requested'].includes(r.status) : r.status === f;

  function adminRow(r) {
    const t = CAT.findTier(r.tierId);
    const rev = r.reveal || {};
    let action = '';
    if (r.status === 'awaiting_reveal' || r.status === 'revealed') {
      action = `
        <form class="admin-form" data-act="reveal" data-rip="${esc(r.id)}">
          <div class="admin-grid">
            <input type="text" name="team" placeholder="${r.tierId === 'grail-rip' ? 'Team (none for USA paint)' : 'Team'}" ${r.tierId === 'grail-rip' ? '' : 'required'} value="${esc(rev.team || '')}" />
            <input type="text" name="signer" placeholder="Signer" required value="${esc(rev.signer || '')}" />
            <input type="text" name="item" placeholder="Item (${esc(t ? t.helmetType : '')})" value="${esc(rev.item || '')}" />
            <input type="text" name="coaSerial" placeholder="COA serial" required value="${esc(rev.coaSerial || '')}" />
            <input type="text" name="hologram" placeholder="Hologram #" value="${esc(rev.hologram || '')}" />
            <input name="signedOn" type="date" value="${esc(rev.signedOn || '')}" aria-label="Signed on" />
            <input type="text" name="inscription" placeholder="Inscription (optional)" value="${esc(rev.inscription || '')}" />
            <input name="buyback" type="number" step="0.01" min="0" placeholder="Buyback $" required
              value="${rev.buyback != null ? (rev.buyback / 100).toFixed(2) : ((t ? t.price : 0) * 0.7 / 100).toFixed(2)}" aria-label="Buyback offer in dollars" />
          </div>
          <button class="btn btn-primary" type="submit">${r.status === 'revealed' ? 'Update reveal' : 'Reveal to customer'}</button>
        </form>`;
    } else if (r.status === 'ship_requested') {
      action = `
        <p><strong>Ship to:</strong><br/>${esc(r.shipTo).replace(/\n/g, '<br/>')}</p>
        <form class="admin-form inline" data-act="markShipped" data-rip="${esc(r.id)}">
          <input type="text" name="tracking" placeholder="Tracking number" />
          <button class="btn btn-primary" type="submit">Mark shipped</button>
        </form>`;
    } else if (r.status === 'sell_requested') {
      action = `
        <p><strong>Pay ${money(r.payout.amount)}</strong> via ${esc(PAYOUT_LABELS[r.payout.method] || r.payout.method)} to <code>${esc(r.payout.handle)}</code></p>
        <form class="admin-form inline" data-act="markPaid" data-rip="${esc(r.id)}">
          <input type="text" name="note" placeholder="Payment note / transaction id" />
          <button class="btn btn-primary" type="submit">Mark paid</button>
        </form>`;
    } else if (r.status === 'shipped') {
      action = `<p class="muted">Shipped${r.tracking ? ' · ' + esc(r.tracking) : ''}</p>`;
    } else if (r.status === 'paid') {
      action = `<p class="muted">Paid ${money(r.payout.amount)} via ${esc(PAYOUT_LABELS[r.payout.method] || r.payout.method)}${r.note ? ' · ' + esc(r.note) : ''}</p>`;
    }
    return `
      <article class="panel admin-rip">
        <div class="rip-head">
          <div>
            <h3 style="margin:0">${esc(t ? t.name : r.tierId)} <span class="muted" style="font-size:.85rem">${esc(r.id)}</span></h3>
            <div class="muted" style="font-size:.88rem">Order ${esc(r.orderCode)} · ${esc(r.email)} · ${esc(new Date(r.createdAt).toLocaleDateString())}</div>
            ${r.reveal ? `<div style="font-size:.9rem;margin-top:4px">${esc(teamText(r.reveal))} · ${esc(r.reveal.signer)} · COA ${esc(r.reveal.coaSerial)}</div>` : ''}
          </div>
          ${chip(r.status)}
        </div>
        ${action}
      </article>`;
  }

  function renderAdminList() {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const n = adminRips.filter((r) => matches(r, el.dataset.count)).length;
      el.textContent = n ? n : '';
    });
    const list = adminRips.filter((r) => matches(r, adminFilter));
    document.getElementById('admin-list').innerHTML = list.length
      ? list.map(adminRow).join('')
      : '<p class="muted">Nothing here.</p>';
  }

  async function loadAdmin(token) {
    try {
      adminRips = (await api('admin', { action: 'list' }, token)).rips;
      renderAdminList();
    } catch (err) {
      if (err.status === 401) { session.del(ADMIN_TOKEN_KEY); toast('Wrong admin token.'); return window.dispatchEvent(new HashChangeEvent('hashchange')); }
      document.getElementById('admin-list').innerHTML = `<div class="notice">${esc(err.message)}</div>`;
    }
  }

  function bindAdmin() {
    const tokenForm = document.getElementById('token-form');
    if (tokenForm) {
      tokenForm.addEventListener('submit', (e) => {
        e.preventDefault();
        session.set(ADMIN_TOKEN_KEY, tokenForm.token.value);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      return;
    }
    const token = session.get(ADMIN_TOKEN_KEY);
    document.getElementById('sign-out').addEventListener('click', () => {
      session.del(ADMIN_TOKEN_KEY);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    document.querySelector('.tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      adminFilter = b.dataset.filter;
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === b));
      renderAdminList();
    });

    const create = document.getElementById('create-form');
    create.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!create.reportValidity()) return;
      const items = [...create.querySelectorAll('[data-tier]')]
        .map((i) => ({ tierId: i.dataset.tier, qty: parseInt(i.value, 10) || 0 }))
        .filter((i) => i.qty > 0);
      if (!items.length) return toast('Add at least one helmet.');
      try {
        const { order } = await api('admin', { action: 'createOrder', email: create.email.value, shipTo: create.shipTo.value, items }, token);
        document.getElementById('create-out').innerHTML =
          `<div class="notice" style="margin-top:12px">Order created. Send the customer their code: <strong class="order-code">${esc(order.code)}</strong> (they sign in to My Rips with it and ${esc(order.email)}).</div>`;
        create.reset();
        loadAdmin(token);
      } catch (err) { toast(err.message); }
    });

    document.getElementById('admin-list').addEventListener('submit', async (e) => {
      const f = e.target.closest('form[data-act]');
      if (!f) return;
      e.preventDefault();
      if (!f.reportValidity()) return;
      const payload = { action: f.dataset.act, ripId: f.dataset.rip };
      new FormData(f).forEach((v, k) => (payload[k] = v));
      if (payload.buyback != null) payload.buyback = Math.round(parseFloat(payload.buyback) * 100);
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const { rip } = await api('admin', payload, token);
        adminRips = adminRips.map((r) => (r.id === rip.id ? rip : r));
        renderAdminList();
        toast('Saved');
      } catch (err) {
        toast(err.message);
        btn.disabled = false;
      }
    });

    loadAdmin(token);
  }

  window.LR_PAGES = {
    rips: { view: viewRips, bind: bindRips },
    admin: { view: viewAdmin, bind: bindAdmin },
  };
})();
