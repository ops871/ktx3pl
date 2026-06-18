// ============================================================
//  KTX 3PL Warehouse Tracker - Supabase client
//  ------------------------------------------------------------
//  Initializes the Supabase JS client from the CDN global
//  (window.supabase, loaded in index.html) using the values
//  in js/config.js. Exposes window.db for the other scripts.
// ============================================================
(function () {
  const cfg = window.APP_CONFIG || {};

  if (
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_ANON_KEY ||
    cfg.SUPABASE_URL === "YOUR_SUPABASE_PROJECT_URL" ||
    cfg.SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY"
  ) {
    document.addEventListener("DOMContentLoaded", () => {
      const box = document.getElementById("auth-error");
      if (box) {
        box.hidden = false;
        box.textContent =
          "App not configured: add your Supabase URL and anon key in js/config.js.";
      }
    });
    console.error(
      "[KTX 3PL] Missing Supabase credentials. Edit js/config.js before using the app."
    );
    return;
  }

  // window.supabase is provided by the @supabase/supabase-js@2 CDN script.
  window.db = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );
})();
