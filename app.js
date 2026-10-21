const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const state = { user: null, goal: 2500, logs: [] };

const dayKey = d => { d = new Date(d); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const fmt = n => n.toLocaleString();

/* ---------- auth ---------- */
function say(text, ok) { $("msg").textContent = text; $("msg").className = ok ? "ok" : ""; }

$("auth-form").addEventListener("submit", async e => {
  e.preventDefault(); say("");
  const { error } = await sb.auth.signInWithPassword({ email: $("email").value, password: $("password").value });
  if (error) say(error.message);
});
$("signup").addEventListener("click", async () => {
  say("");
  if (!$("auth-form").reportValidity()) return;
  const { data, error } = await sb.auth.signUp({ email: $("email").value, password: $("password").value });
  if (error) return say(error.message);
  if (!data.session) say("Account created. Check your email to confirm, then sign in.", true);
});
$("signout").addEventListener("click", () => sb.auth.signOut());

async function route(session) {
  state.user = session ? session.user : null;
  $("auth").hidden = !!session;
  $("app").hidden = !session;
  if (session) await load();
}

/* ---------- data ---------- */
async function load() {
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6);
  const [p, l] = await Promise.all([
    sb.from("profiles").select("goal_ml").eq("id", state.user.id).maybeSingle(),
    sb.from("water_logs").select("id, amount_ml, created_at")
      .gte("created_at", start.toISOString()).order("created_at", { ascending: false })
  ]);
  state.goal = p.data ? p.data.goal_ml : 2500;
  state.logs = l.data || [];
  $("goal").value = state.goal;
  render();
}

async function addWater(ml) {
  ml = Math.round(ml);
  if (!ml || ml < 1 || ml > 3000) return;
  const { data, error } = await sb.from("water_logs").insert({ amount_ml: ml }).select().single();
  if (error) return alert("Could not save: " + error.message);
  state.logs.unshift(data);
  render();
}

async function removeLog(id) {
  const { error } = await sb.from("water_logs").delete().eq("id", id);
  if (error) return alert("Could not delete: " + error.message);
  state.logs = state.logs.filter(x => x.id !== id);
  render();
}

$("quick").addEventListener("click", e => { if (e.target.dataset.ml) addWater(+e.target.dataset.ml); });
$("custom").addEventListener("submit", e => {
  e.preventDefault(); addWater(+$("custom-ml").value); $("custom-ml").value = "";
});
$("goal-form").addEventListener("submit", async e => {
  e.preventDefault();
  const g = Math.round(+$("goal").value);
  if (g < 500 || g > 10000) return alert("Choose a goal between 500 and 10,000 ml.");
  const { error } = await sb.from("profiles").upsert({ id: state.user.id, goal_ml: g });
  if (error) return alert("Could not save goal: " + error.message);
  state.goal = g; render();
});

/* ---------- render ---------- */
function render() {
  const today = dayKey(new Date());
  const todays = state.logs.filter(x => dayKey(x.created_at) === today);
  const total = todays.reduce((s, x) => s + x.amount_ml, 0);
  const pct = Math.min(total / state.goal, 1);

  $("total").textContent = fmt(total);
  $("goal-label").textContent = fmt(state.goal);
  $("water").style.transform = `translateY(${285 - pct * 265}px)`;
  $("status").textContent = total === 0 ? "Nothing logged yet today."
    : total >= state.goal ? "Goal reached. Nice work."
    : `${fmt(state.goal - total)} ml to go.`;

  const ul = $("log"); ul.replaceChildren();
  todays.forEach(x => {
    const li = document.createElement("li");
    const ml = Object.assign(document.createElement("span"), { className: "ml", textContent: x.amount_ml + " ml" });
    const t = Object.assign(document.createElement("span"), { className: "t",
      textContent: new Date(x.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) });
    const del = Object.assign(document.createElement("button"), { textContent: "Delete" });
    del.setAttribute("aria-label", `Delete ${x.amount_ml} ml entry`);
    del.onclick = () => removeLog(x.id);
    li.append(ml, t, del); ul.append(li);
  });
  $("empty").hidden = todays.length > 0;

  // week chart
  const week = $("week"); week.replaceChildren();
  const totals = {};
  state.logs.forEach(x => { const k = dayKey(x.created_at); totals[k] = (totals[k] || 0) + x.amount_ml; });
  const max = Math.max(state.goal, ...Object.values(totals));
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const v = totals[dayKey(d)] || 0;
    const col = document.createElement("div"); col.className = "day" + (i === 0 ? " today" : "");
    const bar = document.createElement("div"); bar.className = "bar" + (v >= state.goal ? " hit" : "");
    bar.style.height = (v / max * 100) + "%"; bar.title = v + " ml";
    const lbl = document.createElement("b"); lbl.textContent = d.toLocaleDateString([], { weekday: "short" });
    col.append(bar, lbl); week.append(col);
  }
}

/* ---------- start ---------- */
sb.auth.getSession().then(({ data }) => route(data.session));
sb.auth.onAuthStateChange((_e, s) => route(s));
