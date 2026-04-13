// ─── Auth helpers — localStorage-based user store ────────────────────────────
export const EMAIL_API   = "http://localhost:8003";
export const TRACKER_API = "http://localhost:8004";

export function getUsers() {
  try { return JSON.parse(localStorage.getItem("trendhive_users") || "{}"); }
  catch(e) { return {}; }
}

export function saveUser(email, name, pass) {
  const u = getUsers();
  u[email.toLowerCase()] = { name, pass, created: new Date().toISOString() };
  localStorage.setItem("trendhive_users", JSON.stringify(u));
}

export function checkUser(email, pass) {
  const u    = getUsers();
  const user = u[email.toLowerCase()];
  if (!user)           return "no_account";
  if (user.pass !== pass) return "wrong_pass";
  return "ok";
}

export function trackPage(page, userEmail = "anonymous", userName = "Unknown") {
  try {
    fetch(TRACKER_API + "/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "page_view",
        page,
        detail: page,
        email: userEmail,
        name: userName,
        device: navigator.userAgent.slice(0, 60),
      }),
    }).catch(() => {});
  } catch(e) {}
}
