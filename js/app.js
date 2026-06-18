// ============================================================
//  KTX 3PL Warehouse Tracker - application logic
//  ------------------------------------------------------------
//  Tabs, projects + inbound/outbound CRUD, project filters and
//  paperwork (file) attachments backed by Supabase Storage.
//  Depends on window.db (js/supabase.js) and the ktx:session
//  event dispatched by js/auth.js.
// ============================================================
(function () {
  if (!window.db) return; // supabase.js already surfaced a config error.

  const db = window.db;
  const BUCKET = (window.APP_CONFIG && window.APP_CONFIG.STORAGE_BUCKET) || "paperwork";

  // In-memory caches so dropdowns / lookups don't re-query constantly.
  let projects = [];
  let loaded = false;
  let attachmentCtx = null; // { recordType, recordId } for the attachments modal.

  // ---------------- Small helpers ----------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function fmtDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function labelize(status) {
    return String(status || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function badge(status) {
    const s = esc(status || "");
    return `<span class="badge badge-${s}">${esc(labelize(status))}</span>`;
  }

  let toastTimer = null;
  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 3000);
  }

  function projectName(id) {
    const p = projects.find((x) => x.id === id);
    return p ? p.name : "Unknown project";
  }

  // ---------------- Tabs ----------------
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tab;
      $$(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      $$(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === `tab-${name}`);
      });
    });
  });

  // ---------------- Modals ----------------
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.hidden = false;
  }
  function closeModal(modal) {
    if (modal) modal.hidden = true;
  }

  $$("[data-open-modal]").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.openModal));
  });

  // Close on the X / Cancel buttons and on backdrop click.
  document.addEventListener("click", (e) => {
    const closer = e.target.closest("[data-close-modal]");
    if (closer) {
      closeModal(closer.closest(".modal"));
      return;
    }
    if (e.target.classList && e.target.classList.contains("modal")) {
      closeModal(e.target);
    }
  });

  // ---------------- Data loading ----------------
  async function loadProjects() {
    const { data, error } = await db
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast(error.message || "Failed to load projects.");
      return;
    }
    projects = data || [];
    renderProjects();
    populateProjectSelects();
  }

  async function loadInbound() {
    const filter = $("#inbound-project-filter");
    const projectId = filter ? filter.value : "";
    let query = db
      .from("inbound_records")
      .select("*")
      .order("created_at", { ascending: false });
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) {
      toast(error.message || "Failed to load inbound records.");
      return;
    }
    renderRecords("inbound", data || []);
  }

  async function loadOutbound() {
    const filter = $("#outbound-project-filter");
    const projectId = filter ? filter.value : "";
    let query = db
      .from("outbound_records")
      .select("*")
      .order("created_at", { ascending: false });
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) {
      toast(error.message || "Failed to load outbound records.");
      return;
    }
    renderRecords("outbound", data || []);
  }

  async function loadAll() {
    await loadProjects();
    await Promise.all([loadInbound(), loadOutbound()]);
  }

  // ---------------- Rendering: projects ----------------
  function renderProjects() {
    const list = $("#projects-list");
    if (!list) return;
    if (!projects.length) {
      list.innerHTML = `<div class="empty">No projects yet. Create your first project to start tracking.</div>`;
      return;
    }
    list.innerHTML = projects
      .map(
        (p) => `
        <div class="card">
          <div class="card-head">
            <span class="card-title">${esc(p.name)}</span>
            ${badge(p.status)}
          </div>
          ${p.description ? `<div class="card-desc">${esc(p.description)}</div>` : ""}
          <div class="card-meta">Created ${esc(fmtDate(p.created_at))}</div>
        </div>`
      )
      .join("");
  }

  function populateProjectSelects() {
    const options =
      `<option value="">All projects</option>` +
      projects.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");

    // Filters keep the "All projects" default; remember the current selection.
    ["#inbound-project-filter", "#outbound-project-filter"].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      const current = el.value;
      el.innerHTML = options;
      el.value = current;
    });

    // Form selects require a real project (no "All projects" entry).
    const formOptions = projects
      .map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`)
      .join("");
    $$("[data-project-select]").forEach((el) => {
      const current = el.value;
      el.innerHTML = formOptions;
      if (current) el.value = current;
    });
  }

  // ---------------- Rendering: records ----------------
  function renderRecords(type, records) {
    const list = $(`#${type}-list`);
    if (!list) return;
    if (!records.length) {
      list.innerHTML = `<div class="empty">No ${type} records yet.</div>`;
      return;
    }
    list.innerHTML = records
      .map((r) => {
        const ref = r.reference_no || "(no reference)";
        const lines = [];
        lines.push(`<div class="record-line">Project: ${esc(projectName(r.project_id))}</div>`);
        if (r.carrier) lines.push(`<div class="record-line">Carrier: ${esc(r.carrier)}</div>`);
        if (type === "outbound" && r.destination)
          lines.push(`<div class="record-line">Destination: ${esc(r.destination)}</div>`);
        if (r.quantity != null && r.quantity !== "")
          lines.push(`<div class="record-line">Quantity: ${esc(r.quantity)}</div>`);
        if (r.description)
          lines.push(`<div class="record-line">${esc(r.description)}</div>`);
        lines.push(`<div class="record-line">Created ${esc(fmtDate(r.created_at))}</div>`);

        return `
          <div class="record">
            <div class="record-top">
              <span class="record-ref">${esc(ref)}</span>
              ${badge(r.status)}
            </div>
            ${lines.join("")}
            <div class="record-actions">
              <button class="btn btn-ghost btn-sm" data-attachments data-record-type="${type}" data-record-id="${esc(r.id)}">Paperwork</button>
              <button class="btn btn-danger btn-sm" data-delete-record data-record-type="${type}" data-record-id="${esc(r.id)}">Delete</button>
            </div>
          </div>`;
      })
      .join("");
  }

  // ---------------- Form submissions ----------------
  async function currentUserId() {
    const { data } = await db.auth.getSession();
    return data.session ? data.session.user.id : null;
  }

  function readForm(form) {
    const fd = new FormData(form);
    const out = {};
    fd.forEach((value, key) => {
      out[key] = typeof value === "string" ? value.trim() : value;
    });
    return out;
  }

  async function submitProject(form) {
    const v = readForm(form);
    if (!v.name) return;
    const payload = {
      name: v.name,
      description: v.description || null,
      status: v.status || "active",
      created_by: await currentUserId(),
    };
    const { error } = await db.from("projects").insert(payload);
    if (error) {
      toast(error.message || "Failed to save project.");
      return;
    }
    form.reset();
    closeModal(form.closest(".modal"));
    toast("Project saved.");
    await loadProjects();
  }

  function recordPayload(v, extra) {
    const payload = {
      project_id: v.project_id || null,
      reference_no: v.reference_no || null,
      carrier: v.carrier || null,
      description: v.description || null,
      quantity: v.quantity ? Number(v.quantity) : null,
      status: v.status || "pending",
    };
    return Object.assign(payload, extra);
  }

  async function submitInbound(form) {
    const v = readForm(form);
    if (!v.project_id) {
      toast("Select a project first.");
      return;
    }
    const payload = recordPayload(v, { created_by: await currentUserId() });
    const { error } = await db.from("inbound_records").insert(payload);
    if (error) {
      toast(error.message || "Failed to save inbound record.");
      return;
    }
    form.reset();
    closeModal(form.closest(".modal"));
    toast("Inbound record saved.");
    await loadInbound();
  }

  async function submitOutbound(form) {
    const v = readForm(form);
    if (!v.project_id) {
      toast("Select a project first.");
      return;
    }
    const payload = recordPayload(v, {
      destination: v.destination || null,
      created_by: await currentUserId(),
    });
    const { error } = await db.from("outbound_records").insert(payload);
    if (error) {
      toast(error.message || "Failed to save outbound record.");
      return;
    }
    form.reset();
    closeModal(form.closest(".modal"));
    toast("Outbound record saved.");
    await loadOutbound();
  }

  document.addEventListener("submit", (e) => {
    const form = e.target;
    const kind = form.getAttribute && form.getAttribute("data-form");
    if (!kind) return;
    e.preventDefault();
    if (kind === "project") submitProject(form);
    else if (kind === "inbound") submitInbound(form);
    else if (kind === "outbound") submitOutbound(form);
    else if (kind === "attachment") submitAttachment(form);
  });

  // ---------------- Delete records ----------------
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-delete-record]");
    if (!btn) return;
    const type = btn.dataset.recordType;
    const id = btn.dataset.recordId;
    if (!confirm("Delete this record? This cannot be undone.")) return;
    const table = type === "inbound" ? "inbound_records" : "outbound_records";
    const { error } = await db.from(table).delete().eq("id", id);
    if (error) {
      toast(error.message || "Failed to delete record.");
      return;
    }
    toast("Record deleted.");
    if (type === "inbound") loadInbound();
    else loadOutbound();
  });

  // ---------------- Attachments ----------------
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-attachments]");
    if (!btn) return;
    attachmentCtx = {
      recordType: btn.dataset.recordType,
      recordId: btn.dataset.recordId,
    };
    openModal("attachments-modal");
    loadAttachments();
  });

  async function loadAttachments() {
    const list = $("#attachments-list");
    if (!list || !attachmentCtx) return;
    list.innerHTML = `<div class="empty">Loading…</div>`;
    const { data, error } = await db
      .from("attachments")
      .select("*")
      .eq("record_type", attachmentCtx.recordType)
      .eq("record_id", attachmentCtx.recordId)
      .order("created_at", { ascending: false });
    if (error) {
      list.innerHTML = `<div class="empty">${esc(error.message || "Failed to load paperwork.")}</div>`;
      return;
    }
    if (!data || !data.length) {
      list.innerHTML = `<div class="empty">No paperwork uploaded yet.</div>`;
      return;
    }
    list.innerHTML = data
      .map(
        (a) => `
        <div class="attachment-row">
          <a href="#" data-download="${esc(a.file_path)}">${esc(a.file_name)}</a>
          <button class="btn btn-danger btn-sm" data-delete-attachment="${esc(a.id)}" data-path="${esc(a.file_path)}">Remove</button>
        </div>`
      )
      .join("");
  }

  // Generate a short-lived signed URL on demand (the bucket is private).
  document.addEventListener("click", async (e) => {
    const link = e.target.closest("[data-download]");
    if (!link) return;
    e.preventDefault();
    const path = link.dataset.download;
    const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data) {
      toast(error ? error.message : "Could not open file.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  });

  async function submitAttachment(form) {
    if (!attachmentCtx) return;
    const fileInput = form.querySelector('input[type="file"]');
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) {
      toast("Choose a file to upload.");
      return;
    }
    const userId = await currentUserId();
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${attachmentCtx.recordType}/${attachmentCtx.recordId}/${Date.now()}_${safeName}`;

    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false });
    if (upErr) {
      toast(upErr.message || "Upload failed.");
      return;
    }

    const { error: rowErr } = await db.from("attachments").insert({
      record_type: attachmentCtx.recordType,
      record_id: attachmentCtx.recordId,
      file_path: path,
      file_name: file.name,
      uploaded_by: userId,
    });
    if (rowErr) {
      toast(rowErr.message || "Saved file but failed to record it.");
      return;
    }
    form.reset();
    toast("Paperwork uploaded.");
    loadAttachments();
  }

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-delete-attachment]");
    if (!btn) return;
    const id = btn.dataset.deleteAttachment;
    const path = btn.dataset.path;
    if (!confirm("Remove this file?")) return;
    // Remove the storage object first, then the table row.
    await db.storage.from(BUCKET).remove([path]);
    const { error } = await db.from("attachments").delete().eq("id", id);
    if (error) {
      toast(error.message || "Failed to remove file.");
      return;
    }
    toast("File removed.");
    loadAttachments();
  });

  // ---------------- Filters ----------------
  $("#inbound-project-filter")?.addEventListener("change", loadInbound);
  $("#outbound-project-filter")?.addEventListener("change", loadOutbound);

  // ---------------- Session wiring ----------------
  // auth.js dispatches this whenever the Supabase session changes.
  document.addEventListener("ktx:session", (e) => {
    const session = e.detail && e.detail.session;
    if (session) {
      if (!loaded) {
        loaded = true;
        loadAll();
      }
    } else {
      loaded = false;
      projects = [];
    }
  });
})();
