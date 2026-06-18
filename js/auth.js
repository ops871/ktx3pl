// ============================================================
//  KTX 3PL Warehouse Tracker - authentication
//  ------------------------------------------------------------
//  Handles login, signup, logout and toggling between the
//  auth view and the app view based on the Supabase session.
//  Depends on window.db (js/supabase.js).
// ============================================================
(function () {
  if (!window.db) return; // supabase.js already surfaced a config error.

  const authView = document.getElementById("auth-view");
  const appView = document.getElementById("app-view");
  const errorBox = document.getElementById("auth-error");
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const toggleToSignup = document.getElementById("toggle-to-signup");
  const toggleToLogin = document.getElementById("toggle-to-login");
  const currentUser = document.getElementById("current-user");
  const logoutBtn = document.getElementById("logout-btn");

  function showError(message) {
    if (!errorBox) return;
    errorBox.hidden = false;
    errorBox.textContent = message;
  }

  function clearError() {
    if (!errorBox) return;
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  // Switch between the login and signup forms.
  function showSignup(show) {
    clearError();
    if (loginForm) loginForm.hidden = show;
    if (signupForm) signupForm.hidden = !show;
    if (toggleToSignup) toggleToSignup.hidden = show;
    if (toggleToLogin) toggleToLogin.hidden = !show;
  }

  if (toggleToSignup) {
    toggleToSignup.querySelector("a")?.addEventListener("click", (e) => {
      e.preventDefault();
      showSignup(true);
    });
  }
  if (toggleToLogin) {
    toggleToLogin.querySelector("a")?.addEventListener("click", (e) => {
      e.preventDefault();
      showSignup(false);
    });
  }

  // Render the correct view for the current session.
  function renderSession(session) {
    const signedIn = !!session;
    if (authView) authView.hidden = signedIn;
    if (appView) appView.hidden = !signedIn;

    if (signedIn && currentUser) {
      const u = session.user;
      const name = u.user_metadata?.full_name || u.email || "Signed in";
      currentUser.textContent = name;
    }

    // Let app.js know the session changed so it can (re)load data.
    document.dispatchEvent(
      new CustomEvent("ktx:session", { detail: { session } })
    );
  }

  // ---------------- Login ----------------
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError();
      const data = new FormData(loginForm);
      const email = String(data.get("email") || "").trim();
      const password = String(data.get("password") || "");

      const { error } = await window.db.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        showError(error.message || "Unable to sign in.");
        return;
      }
      loginForm.reset();
    });
  }

  // ---------------- Signup ----------------
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError();
      const data = new FormData(signupForm);
      const fullName = String(data.get("full_name") || "").trim();
      const email = String(data.get("email") || "").trim();
      const password = String(data.get("password") || "");

      const { error } = await window.db.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) {
        showError(error.message || "Unable to create account.");
        return;
      }
      signupForm.reset();
      // If email confirmation is enabled the session won't exist yet.
      const { data: sessionData } = await window.db.auth.getSession();
      if (!sessionData.session) {
        showSignup(false);
        showError("Account created. Check your email to confirm, then sign in.");
      }
    });
  }

  // ---------------- Logout ----------------
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await window.db.auth.signOut();
    });
  }

  // ---------------- Session bootstrap ----------------
  window.db.auth.getSession().then(({ data }) => {
    renderSession(data.session);
  });

  window.db.auth.onAuthStateChange((_event, session) => {
    renderSession(session);
  });
})();
