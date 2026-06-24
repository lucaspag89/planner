/* ===================================================================
   Controle Financeiro - lógica principal
   Front-end estático (GitHub Pages) + Supabase (banco + login + API)
   =================================================================== */

// ---------------------------------------------------------------------
// Inicialização do Supabase
// ---------------------------------------------------------------------
let sb = null;
const configOk =
  window.SUPABASE_URL &&
  window.SUPABASE_ANON_KEY &&
  !String(window.SUPABASE_URL).includes("COLE_AQUI") &&
  !String(window.SUPABASE_ANON_KEY).includes("COLE_AQUI");

// Inicializa o cliente Supabase de forma segura.
// Se a biblioteca (CDN) não tiver carregado ou a config estiver vazia,
// NÃO deixamos o script quebrar — assim os botões da tela continuam funcionando.
function initSupabase() {
  const libOk = window.supabase && typeof window.supabase.createClient === "function";
  const warn = document.getElementById("auth-config-warn");

  if (!configOk) {
    if (warn) {
      warn.style.display = "block";
      warn.innerHTML = "⚠️ Configure o Supabase em <code>js/config.js</code> antes de usar.";
    }
    return;
  }
  if (!libOk) {
    if (warn) {
      warn.style.display = "block";
      warn.innerHTML = "⚠️ Não foi possível carregar a biblioteca do Supabase. " +
        "Verifique sua conexão com a internet (ou se algum bloqueador está ativo) e recarregue a página.";
    }
    return;
  }
  try {
    sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    registerAuthListener();
  } catch (e) {
    console.error("Falha ao iniciar Supabase:", e);
    if (warn) {
      warn.style.display = "block";
      warn.textContent = "⚠️ Erro ao iniciar o Supabase: " + e.message;
    }
  }
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const BRL = (n) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d) => {
  if (!d) return "";
  const [y, m, day] = String(d).split("T")[0].split("-");
  return `${day}/${m}/${y.slice(2)}`;
};

const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (key) => {
  const [y, m] = key.split("-");
  const names = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${names[+m - 1]} de ${y}`;
};

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

// Categorias padrão (espelham o app de referência)
const CATEGORIES = [
  ["Casa","🏠"],["Mercado","🛒"],["Restaurantes","🍽"],["Transporte","🚗"],
  ["Saúde","💊"],["Lazer","🎬"],["Viagens","✈"],["Educação","🎓"],
  ["Assinaturas e serviços","🔁"],["Roupas e acessórios","👕"],["Esportes","🏅"],
  ["Filhos e família","👨‍👩‍👧"],["Pets","🐾"],["Cuidados pessoais","💇"],
  ["Compras","🛍"],["Presentes e doações","🎁"],["Impostos e taxas","🧾"],
  ["Dívidas e empréstimos","💳"],["Investimentos","📈"],["Renda","💰"],["Outros","📦"]
];
const catIcon = (name) => (CATEGORIES.find(c => c[0] === name) || ["",""])[1] || "📦";

// Estado em memória
const state = { user: null, view: "home", planMonth: monthKey() };
let chartRefs = [];
function destroyCharts(){ chartRefs.forEach(c => { try{c.destroy();}catch(e){} }); chartRefs = []; }

// ---------------------------------------------------------------------
// AUTENTICAÇÃO  (modo "senha única" para uso pessoal)
// A tela pede só uma senha. O login usa um e-mail fixo (config.js).
// Na primeira vez a conta é criada automaticamente com a senha digitada.
// ---------------------------------------------------------------------
const LOGIN_EMAIL = window.APP_LOGIN_EMAIL || "app.pessoal@local.user";

$("#auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#auth-msg");
  if (!sb) {
    msg.className = "auth-msg error";
    msg.textContent = configOk
      ? "Conexão com o Supabase não foi iniciada. Recarregue a página (a biblioteca pode não ter carregado)."
      : "Configure o Supabase em js/config.js antes de usar.";
    return;
  }
  const password = $("#auth-password").value;
  if (password.length < 6) {
    msg.className = "auth-msg error";
    msg.textContent = "A senha precisa ter pelo menos 6 caracteres.";
    return;
  }
  msg.className = "auth-msg";
  msg.textContent = "Aguarde...";

  try {
    // 1) tenta entrar com a senha
    const { error } = await sb.auth.signInWithPassword({ email: LOGIN_EMAIL, password });
    if (!error) return; // sucesso -> onAuthStateChange abre o app

    // 2) login falhou -> pode ser a primeira vez (conta ainda não existe)
    if (/Invalid login/i.test(error.message)) {
      const { data: su, error: e2 } = await sb.auth.signUp({ email: LOGIN_EMAIL, password });
      if (e2) {
        // já existe conta -> então a senha digitada está errada
        if (/already registered|already exists/i.test(e2.message)) {
          throw new Error("Senha incorreta.");
        }
        throw e2;
      }
      if (su.session) return; // criou e já logou (confirmação de e-mail desligada)

      // criou mas o Supabase exige confirmação de e-mail
      const { error: e3 } = await sb.auth.signInWithPassword({ email: LOGIN_EMAIL, password });
      if (!e3) return;
      msg.className = "auth-msg ok";
      msg.textContent = "Senha cadastrada! Desligue 'Confirm email' no Supabase " +
        "(Authentication → Providers → Email) e clique em Entrar novamente.";
      return;
    }
    // 3) outro erro
    throw error;
  } catch (err) {
    msg.className = "auth-msg error";
    msg.textContent = traduzErro(err.message);
  }
});

function traduzErro(m){
  m = m || "Erro desconhecido";
  if (/Invalid login/i.test(m)) return "E-mail ou senha incorretos.";
  if (/already registered|already exists/i.test(m)) return "Este e-mail já tem conta. Faça login.";
  if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail antes de entrar.";
  if (/Signups? not allowed|signup is disabled/i.test(m)) return "Cadastro desativado no Supabase. Ative em Authentication → Providers → Email.";
  if (/Password should be at least/i.test(m)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/valid email|invalid format|Unable to validate email/i.test(m)) return "E-mail inválido.";
  if (/rate limit|too many/i.test(m)) return "Muitas tentativas. Aguarde um instante e tente de novo.";
  if (/Failed to fetch|NetworkError|fetch/i.test(m)) return "Falha de conexão com o Supabase. Verifique sua internet / a URL em config.js.";
  return m;
}

$("#logout-btn").addEventListener("click", async () => {
  if (sb) await sb.auth.signOut();
});

// Reage a login/logout (chamada por initSupabase, quando o cliente existe)
function registerAuthListener() {
  sb.auth.onAuthStateChange((_event, session) => {
    if (session && session.user) {
      state.user = session.user;
      showApp();
    } else {
      state.user = null;
      $("#app").style.display = "none";
      $("#auth-screen").style.display = "flex";
    }
  });
}

function showApp(){
  $("#auth-screen").style.display = "none";
  $("#app").style.display = "flex";
  const name = state.user.user_metadata?.name || state.user.email.split("@")[0];
  $("#greeting").textContent = `Olá, ${name}!`;
  $("#user-chip").textContent = state.user.email;
  navigate(state.view);
}

// ---------------------------------------------------------------------
// NAVEGAÇÃO
// ---------------------------------------------------------------------
$$(".menu-item").forEach(item => {
  item.addEventListener("click", () => navigate(item.dataset.view));
});

function navigate(view){
  state.view = view;
  $$(".menu-item").forEach(m => m.classList.toggle("active", m.dataset.view === view));
  destroyCharts();
  const c = $("#view-container");
  c.innerHTML = `<div class="spinner">Carregando...</div>`;
  const fn = { home: viewHome, lancamentos: viewLancamentos, plano: viewPlano,
    patrimonio: viewPatrimonio, investimentos: viewInvestimentos, contas: viewContas }[view];
  fn().catch(err => { c.innerHTML = `<div class="empty">Erro: ${escapeHtml(err.message)}</div>`; });
}

// ---------------------------------------------------------------------
// ACESSO A DADOS
// ---------------------------------------------------------------------
async function db(table){ return sb.from(table); }
async function fetchAll(table, order){
  let q = sb.from(table).select("*");
  if (order) q = q.order(order.col, { ascending: order.asc });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------
// VIEW: HOME (dashboard)
// ---------------------------------------------------------------------
async function viewHome(){
  const [assets, tx] = await Promise.all([
    fetchAll("assets"),
    fetchAll("transactions"),
  ]);

  const totalAtivos = assets
    .filter(a => ["investimento","bem_movel","bem_imovel"].includes(a.category))
    .reduce((s,a)=>s+Number(a.value),0);
  const totalPassivos = assets
    .filter(a => ["divida","financiamento"].includes(a.category))
    .reduce((s,a)=>s+Number(a.value),0);
  const geradores = assets
    .filter(a => a.income_generating)
    .reduce((s,a)=>s+Number(a.value),0);
  const pctRenda = totalAtivos ? (geradores/totalAtivos*100) : 0;
  const patrimonioLiquido = totalAtivos - totalPassivos;

  // mês atual
  const mk = monthKey();
  const txMonth = tx.filter(t => String(t.date).startsWith(mk));
  const entradas = txMonth.filter(t=>t.type==="entrada").reduce((s,t)=>s+Number(t.amount),0);
  const saidas   = txMonth.filter(t=>t.type==="saida").reduce((s,t)=>s+Number(t.amount),0);

  // Score simples de saúde financeira (0-100)
  let score = 0;
  score += totalPassivos === 0 ? 35 : Math.max(0, 35 - (totalPassivos/Math.max(totalAtivos,1))*70);
  score += Math.min(35, pctRenda/100*35);
  score += entradas > saidas ? 30 : Math.max(0, (entradas/Math.max(saidas,1))*30);
  score = Math.round(Math.min(100, score));
  const faixa = score>=80?"A todo vapor!":score>=60?"Rota certa!":score>=40?"Atenção":"Cuidado";

  $("#view-container").innerHTML = `
    <div class="grid cards-2">
      <div class="card gauge-wrap">
        <canvas id="gauge" width="280" height="160"></canvas>
        <div class="gauge-score" id="gauge-score">${score}</div>
        <div class="gauge-label">${faixa}</div>
      </div>
      <div class="card">
        <h3>Saúde financeira</h3>
        <div class="health-list">
          <div class="health-item"><span class="chk">✓</span>
            <span>${totalPassivos===0
              ? "Você não possui dívidas no seu patrimônio atual."
              : `Saldo devedor de ${BRL(totalPassivos)} em dívidas/financiamentos.`}</span></div>
          <div class="health-item"><span class="chk">✓</span>
            <span>Você possui <b>${pctRenda.toFixed(2)}%</b> dos seus ativos gerando renda
            (${BRL(geradores)}). Continue aumentando seus ativos geradores de renda!</span></div>
          <div class="health-item"><span class="chk">✓</span>
            <span>No mês: entradas ${BRL(entradas)} e saídas ${BRL(saidas)}
            (${entradas>=saidas?"saldo positivo":"saldo negativo"}).</span></div>
        </div>
      </div>
    </div>

    <div class="grid cards-3" style="margin-top:18px">
      <div class="card"><div class="label">Patrimônio líquido</div><div class="big blue">${BRL(patrimonioLiquido)}</div></div>
      <div class="card"><div class="label">Entradas (mês)</div><div class="big green">${BRL(entradas)}</div></div>
      <div class="card"><div class="label">Saídas (mês)</div><div class="big red">${BRL(saidas)}</div></div>
    </div>

    ${assets.length===0 && tx.length===0 ? `
      <div class="card" style="margin-top:18px">
        <h3>Comece por aqui</h3>
        <p class="hint">Ainda não há dados. Vá em <b>Lançamentos</b> e clique em
        “Carregar dados de exemplo”, ou cadastre suas contas em <b>Patrimônio</b>.</p>
      </div>` : ""}
  `;

  drawGauge(score);
}

function drawGauge(score){
  const ctx = $("#gauge");
  const c = new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [score, 100-score],
        backgroundColor: [scoreColor(score), "#eef1f5"],
        borderWidth: 0,
      }]
    },
    options: {
      rotation: -90, circumference: 180, cutout: "72%",
      plugins: { legend:{display:false}, tooltip:{enabled:false} },
      events: [],
    }
  });
  chartRefs.push(c);
}
function scoreColor(s){ return s>=80?"#16a34a":s>=60?"#22c55e":s>=40?"#f59e0b":"#e0405a"; }

// ---------------------------------------------------------------------
// VIEW: LANÇAMENTOS
// ---------------------------------------------------------------------
async function viewLancamentos(){
  const tx = await fetchAll("transactions", { col:"date", asc:false });
  const mk = monthKey();
  const txMonth = tx.filter(t => String(t.date).startsWith(mk));
  const entradas = tx.filter(t=>t.type==="entrada").reduce((s,t)=>s+Number(t.amount),0);
  const saidas   = tx.filter(t=>t.type==="saida").reduce((s,t)=>s+Number(t.amount),0);

  $("#view-container").innerHTML = `
    <div class="grid cards-3">
      <div class="card"><div class="label">Entradas (total)</div><div class="big green">${BRL(entradas)}</div></div>
      <div class="card"><div class="label">Saídas (total)</div><div class="big red">${BRL(saidas)}</div></div>
      <div class="card"><div class="label">Saldo</div><div class="big ${entradas-saidas>=0?'blue':'red'}">${BRL(entradas-saidas)}</div></div>
    </div>

    <div class="toolbar" style="margin-top:22px">
      <button class="btn primary" id="add-tx">+ Novo lançamento</button>
      <label class="btn" style="position:relative;overflow:hidden">
        Importar extrato (CSV)
        <input type="file" id="csv-input" accept=".csv,text/csv"
          style="position:absolute;inset:0;opacity:0;cursor:pointer">
      </label>
      <a class="btn ghost" href="exemplo-extrato.csv" download>Modelo CSV</a>
      <div class="spacer"></div>
      ${tx.length===0 ? `<button class="btn" id="seed">Carregar dados de exemplo</button>` : ""}
    </div>

    <table>
      <thead><tr>
        <th>Data</th><th>Estabelecimento / Descrição</th><th>Categoria</th>
        <th>Meio de pagamento</th><th style="text-align:right">Valor</th><th></th>
      </tr></thead>
      <tbody id="tx-body">
        ${tx.length===0 ? `<tr><td colspan="6" class="empty">Nenhum lançamento ainda.</td></tr>`
        : tx.map(t => `
          <tr>
            <td>${fmtDate(t.date)}</td>
            <td><b>${escapeHtml(t.establishment || t.description || "—")}</b>
              ${t.establishment && t.description ? `<div class="muted" style="font-size:12px">${escapeHtml(t.description)}</div>`:""}</td>
            <td>${t.category ? `<span class="tag">${catIcon(t.category)} ${escapeHtml(t.category)}</span>`:"—"}</td>
            <td class="muted">${escapeHtml(t.payment_method || "—")}</td>
            <td style="text-align:right" class="${t.type==='entrada'?'amount-in':'amount-out'}">
              ${t.type==='entrada'?'+':'-'} ${BRL(t.amount)}</td>
            <td class="row-actions"><button data-del="${t.id}" title="Excluir">🗑</button></td>
          </tr>`).join("")}
      </tbody>
    </table>
    <p class="hint">Mostrando ${tx.length} lançamento(s). Mês atual: ${txMonth.length}.</p>
  `;

  $("#add-tx").addEventListener("click", () => openTxModal());
  $("#csv-input").addEventListener("change", handleCsv);
  if ($("#seed")) $("#seed").addEventListener("click", seedSampleData);
  $$("#tx-body [data-del]").forEach(b =>
    b.addEventListener("click", () => delRow("transactions", b.dataset.del)));
}

function openTxModal(){
  const today = new Date().toISOString().slice(0,10);
  openModal("Novo lançamento", `
    <div class="form-grid">
      <div class="seg">
        <label><input type="radio" name="type" value="saida" checked><span>Saída</span></label>
        <label><input type="radio" name="type" value="entrada"><span>Entrada</span></label>
      </div>
      <label>Data</label><input type="date" id="f-date" value="${today}">
      <label>Estabelecimento / descrição</label><input id="f-est" placeholder="Ex: Mercado São Luiz">
      <label>Categoria</label>
      <select id="f-cat">${CATEGORIES.map(c=>`<option>${c[0]}</option>`).join("")}</select>
      <label>Meio de pagamento</label><input id="f-pay" placeholder="Ex: Cartão final 8228">
      <label>Valor (R$)</label><input id="f-amount" type="number" step="0.01" min="0" placeholder="0,00">
      <button class="btn primary" id="f-save">Salvar</button>
    </div>
  `);
  $("#f-save").addEventListener("click", async () => {
    const rec = {
      type: $("input[name=type]:checked").value,
      date: $("#f-date").value,
      establishment: $("#f-est").value.trim(),
      category: $("#f-cat").value,
      payment_method: $("#f-pay").value.trim(),
      amount: parseFloat($("#f-amount").value || "0"),
    };
    if (!rec.amount){ alert("Informe um valor."); return; }
    const { error } = await sb.from("transactions").insert(rec);
    if (error) return alert(error.message);
    closeModal(); navigate("lancamentos");
  });
}

// ---------- Importação CSV ----------
function parseCsv(text){
  // separador automático (vírgula ou ponto-e-vírgula)
  const lines = text.replace(/\r/g,"").split("\n").filter(l => l.trim() !== "");
  if (!lines.length) return [];
  const sep = (lines[0].match(/;/g)||[]).length > (lines[0].match(/,/g)||[]).length ? ";" : ",";
  const splitLine = (line) => {
    const out = []; let cur = ""; let q = false;
    for (const ch of line){
      if (ch === '"'){ q = !q; }
      else if (ch === sep && !q){ out.push(cur); cur=""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim().replace(/^"|"$/g,""));
  };
  const headers = splitLine(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(l => {
    const cells = splitLine(l);
    const o = {};
    headers.forEach((h,i)=> o[h] = cells[i] ?? "");
    return o;
  });
}

function normNumber(v){
  if (v == null) return 0;
  let s = String(v).trim().replace(/[R$\s]/g,"");
  // formato BR: 1.234,56  -> remove pontos de milhar, troca vírgula por ponto
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g,"").replace(",",".");
  else s = s.replace(/,/g,"");
  return parseFloat(s) || 0;
}
function normDate(v){
  if (!v) return new Date().toISOString().slice(0,10);
  v = v.trim();
  let m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);   // dd/mm/aa(aa)
  if (m){ let [,d,mo,y]=m; if(y.length===2) y="20"+y; return `${y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}`; }
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);                // aaaa-mm-dd
  if (m) return v.slice(0,10);
  const d = new Date(v); return isNaN(d) ? new Date().toISOString().slice(0,10) : d.toISOString().slice(0,10);
}

async function handleCsv(e){
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const rows = parseCsv(text);
  if (!rows.length){ alert("CSV vazio ou inválido."); return; }

  const pick = (o, keys) => { for(const k of keys){ if(o[k]!=null && o[k]!=="") return o[k]; } return ""; };
  const recs = rows.map(r => {
    const rawValor = pick(r, ["valor","amount","value","montante"]);
    let amount = normNumber(rawValor);
    let type = "saida";
    const tipoTxt = pick(r, ["tipo","type"]).toLowerCase();
    if (/entrada|receita|credito|crédito|in/.test(tipoTxt)) type = "entrada";
    else if (/saida|saída|despesa|debito|débito|out/.test(tipoTxt)) type = "saida";
    else if (amount > 0) type = "entrada";        // sem coluna tipo: positivo=entrada
    else type = "saida";
    amount = Math.abs(amount);
    return {
      date: normDate(pick(r, ["data","date"])),
      establishment: pick(r, ["estabelecimento","descrição","descricao","description","historico","histórico","lançamento","lancamento"]),
      description: pick(r, ["descrição","descricao","description","detalhe"]),
      category: pick(r, ["categoria","category"]) || "Outros",
      payment_method: pick(r, ["meio de pagamento","meio","pagamento","conta","cartão","cartao","payment"]),
      amount, type,
    };
  }).filter(r => r.amount > 0);

  if (!recs.length){ alert("Não encontrei valores válidos no CSV. Veja o modelo CSV."); e.target.value=""; return; }
  if (!confirm(`Importar ${recs.length} lançamento(s)?`)){ e.target.value=""; return; }
  const { error } = await sb.from("transactions").insert(recs);
  e.target.value = "";
  if (error) return alert(error.message);
  alert(`${recs.length} lançamento(s) importado(s)!`);
  navigate("lancamentos");
}

// ---------------------------------------------------------------------
// VIEW: PLANO (orçamento por categoria)
// ---------------------------------------------------------------------
async function viewPlano(){
  const mk = state.planMonth;
  const [budgets, tx] = await Promise.all([ fetchAll("budgets"), fetchAll("transactions") ]);
  const budMonth = budgets.filter(b => b.month === mk);
  const txMonth = tx.filter(t => String(t.date).startsWith(mk) && t.type === "saida");

  // gasto por categoria
  const spent = {};
  txMonth.forEach(t => { const k=t.category||"Outros"; spent[k]=(spent[k]||0)+Number(t.amount); });

  const renda = tx.filter(t => String(t.date).startsWith(mk) && t.type==="entrada")
                  .reduce((s,t)=>s+Number(t.amount),0);
  const totalGasto = Object.values(spent).reduce((a,b)=>a+b,0);
  const totalMeta = budMonth.reduce((s,b)=>s+Number(b.planned),0);
  const saldo = renda - totalGasto;

  // união de categorias (com meta ou com gasto)
  const cats = [...new Set([...budMonth.map(b=>b.category), ...Object.keys(spent)])];
  cats.sort((a,b)=> (spent[b]||0) - (spent[a]||0));

  $("#view-container").innerHTML = `
    <div class="toolbar">
      <button class="btn" id="prev-m">‹</button>
      <b style="min-width:170px;text-align:center">${monthLabel(mk)}</b>
      <button class="btn" id="next-m">›</button>
      <div class="spacer"></div>
      <button class="btn primary" id="set-budget">Definir metas</button>
    </div>

    <div class="grid cards-3">
      <div class="card"><div class="label">Renda no mês</div><div class="big green">${BRL(renda)}</div></div>
      <div class="card"><div class="label">Gastos no mês</div><div class="big red">${BRL(totalGasto)}</div></div>
      <div class="card"><div class="label">Saldo do plano</div><div class="big ${saldo>=0?'blue':'red'}">${BRL(saldo)}</div></div>
    </div>

    <div class="grid cards-2" style="margin-top:18px;align-items:start">
      <div class="card">
        <h3>Gasto x Meta por categoria</h3>
        <canvas id="plan-chart" height="${Math.max(220, cats.length*26)}"></canvas>
      </div>
      <div class="card">
        <h3>Detalhe</h3>
        ${cats.length===0 ? `<p class="hint">Sem dados neste mês. Lance despesas ou defina metas.</p>`
        : cats.map(cat => {
            const gasto = spent[cat]||0;
            const meta = (budMonth.find(b=>b.category===cat)||{}).planned || 0;
            const pct = meta ? Math.min(100, gasto/meta*100) : (gasto?100:0);
            const over = meta && gasto>meta;
            const resta = meta - gasto;
            return `<div class="budget-row">
              <div class="budget-icon">${catIcon(cat)}</div>
              <div class="budget-main">
                <div class="budget-name"><span>${escapeHtml(cat)}</span><span>${BRL(gasto)}</span></div>
                <div class="budget-bar"><div class="${over?'over':''}" style="width:${pct}%"></div></div>
                <div class="budget-sub">
                  <span>${meta?`Meta: ${BRL(meta)}`:"Sem meta"}</span>
                  <span>${meta?(over?`Excedeu ${BRL(-resta)}`:`Restam ${BRL(resta)}`):""}</span>
                </div>
              </div></div>`;
          }).join("")}
      </div>
    </div>
  `;

  $("#prev-m").addEventListener("click", ()=>{ state.planMonth = shiftMonth(mk,-1); navigate("plano"); });
  $("#next-m").addEventListener("click", ()=>{ state.planMonth = shiftMonth(mk,1); navigate("plano"); });
  $("#set-budget").addEventListener("click", ()=> openBudgetModal(budMonth));

  if (cats.length){
    const c = new Chart($("#plan-chart"), {
      type:"bar",
      data:{ labels:cats, datasets:[
        { label:"Gasto", data:cats.map(c=>spent[c]||0), backgroundColor:"#2f6df6" },
        { label:"Meta",  data:cats.map(c=>(budMonth.find(b=>b.category===c)||{}).planned||0), backgroundColor:"#cdd9f5" },
      ]},
      options:{ indexAxis:"y", responsive:true, maintainAspectRatio:false,
        plugins:{legend:{position:"bottom"}},
        scales:{ x:{ ticks:{ callback:v=>"R$"+(v/1000)+"k" } } } }
    });
    chartRefs.push(c);
  }
}

function shiftMonth(mk, delta){
  let [y,m] = mk.split("-").map(Number); m += delta;
  if (m<1){ m=12; y--; } if (m>12){ m=1; y++; }
  return `${y}-${String(m).padStart(2,"0")}`;
}

function openBudgetModal(existing){
  const map = {}; existing.forEach(b=> map[b.category]=b.planned);
  openModal(`Metas - ${monthLabel(state.planMonth)}`, `
    <p class="hint">Defina o quanto pretende gastar em cada categoria neste mês.</p>
    <div class="form-grid" style="max-height:50vh;overflow:auto;margin-top:10px">
      ${CATEGORIES.filter(c=>c[0]!=="Renda").map(c=>`
        <label>${c[1]} ${c[0]}</label>
        <input type="number" step="0.01" min="0" data-cat="${escapeHtml(c[0])}"
          value="${map[c[0]]??""}" placeholder="0,00">
      `).join("")}
    </div>
    <button class="btn primary" id="b-save" style="margin-top:14px">Salvar metas</button>
  `);
  $("#b-save").addEventListener("click", async ()=>{
    const rows = $$("#modal [data-cat]").map(i=>({
      month: state.planMonth, category: i.dataset.cat,
      planned: parseFloat(i.value||"0"), icon: catIcon(i.dataset.cat),
    })).filter(r=>r.planned>0);
    // upsert por (user_id, month, category)
    if (rows.length){
      const { error } = await sb.from("budgets")
        .upsert(rows, { onConflict:"user_id,month,category" });
      if (error) return alert(error.message);
    }
    closeModal(); navigate("plano");
  });
}

// ---------------------------------------------------------------------
// VIEW: PATRIMÔNIO
// ---------------------------------------------------------------------
async function viewPatrimonio(){
  const assets = await fetchAll("assets");
  const grp = (cat)=> assets.filter(a=>a.category===cat);
  const sum = (arr)=> arr.reduce((s,a)=>s+Number(a.value),0);

  const inv = grp("investimento"), moveis = grp("bem_movel"), imoveis = grp("bem_imovel");
  const dividas = grp("divida"), fin = grp("financiamento");
  const totalAtivos = sum(inv)+sum(moveis)+sum(imoveis);
  const totalPassivos = sum(dividas)+sum(fin);
  const geradores = sum(assets.filter(a=>a.income_generating));
  const pl = totalAtivos - totalPassivos;
  const pctRenda = totalAtivos ? geradores/totalAtivos*100 : 0;

  const block = (title, list, cat) => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3>${title}</h3>
        <button class="btn" data-add="${cat}">+ Adicionar</button>
      </div>
      ${list.length===0 ? `<p class="hint">Nada cadastrado.</p>` :
        list.map(a=>`<div class="budget-row">
          <div class="budget-main">
            <div class="budget-name"><span>${escapeHtml(a.name)} ${a.income_generating?'<span class="tag">renda</span>':''}</span>
              <span>${BRL(a.value)}</span></div>
          </div>
          <div class="row-actions"><button data-del-asset="${a.id}">🗑</button></div>
        </div>`).join("")}
    </div>`;

  $("#view-container").innerHTML = `
    <div class="grid cards-3">
      <div class="card"><div class="label">Patrimônio líquido</div><div class="big orange">${BRL(pl)}</div></div>
      <div class="card"><div class="label">Total de ativos</div><div class="big blue">${BRL(totalAtivos)}</div></div>
      <div class="card"><div class="label">Total de passivos</div><div class="big red">${BRL(totalPassivos)}</div></div>
    </div>

    <div class="grid cards-2" style="margin-top:18px;align-items:start">
      <div class="card">
        <h3>Composição dos ativos</h3>
        <canvas id="patr-chart" height="240"></canvas>
        <p class="hint" style="text-align:center">
          ${pctRenda.toFixed(2)}% dos ativos geram renda (${BRL(geradores)})</p>
      </div>
      <div style="display:grid;gap:18px">
        ${block("Investimentos", inv, "investimento")}
        ${block("Bens móveis", moveis, "bem_movel")}
      </div>
    </div>

    <div class="grid cards-2" style="margin-top:18px;align-items:start">
      ${block("Bens imóveis", imoveis, "bem_imovel")}
      ${block("Empréstimos e dívidas", dividas, "divida")}
    </div>
    <div class="grid cards-2" style="margin-top:18px;align-items:start">
      ${block("Financiamentos", fin, "financiamento")}
      <div></div>
    </div>
  `;

  $$("[data-add]").forEach(b=> b.addEventListener("click", ()=> openAssetModal(b.dataset.add)));
  $$("[data-del-asset]").forEach(b=> b.addEventListener("click", ()=> delRow("assets", b.dataset.delAsset)));

  if (totalAtivos>0){
    const c = new Chart($("#patr-chart"), {
      type:"doughnut",
      data:{ labels:["Gerador de renda","Uso pessoal"],
        datasets:[{ data:[geradores, totalAtivos-geradores],
          backgroundColor:["#2f6df6","#cdd9f5"], borderWidth:0 }] },
      options:{ cutout:"62%", plugins:{legend:{position:"bottom"}} }
    });
    chartRefs.push(c);
  }
}

function openAssetModal(cat){
  const titles = { investimento:"Investimento", bem_movel:"Bem móvel",
    bem_imovel:"Bem imóvel", divida:"Dívida", financiamento:"Financiamento" };
  const isAtivo = ["investimento","bem_movel","bem_imovel"].includes(cat);
  openModal(`Adicionar ${titles[cat]}`, `
    <div class="form-grid">
      <label>Nome</label><input id="a-name" placeholder="Ex: Nubank - Lucas">
      <label>Valor (R$)</label><input id="a-value" type="number" step="0.01" min="0" placeholder="0,00">
      ${isAtivo ? `<label style="display:flex;gap:8px;align-items:center">
        <input type="checkbox" id="a-renda" ${cat==="investimento"?"checked":""} style="width:auto">
        Este ativo gera renda</label>`:""}
      <button class="btn primary" id="a-save">Salvar</button>
    </div>
  `);
  $("#a-save").addEventListener("click", async ()=>{
    const rec = { name:$("#a-name").value.trim(), category:cat,
      value:parseFloat($("#a-value").value||"0"),
      income_generating: isAtivo ? $("#a-renda").checked : false };
    if (!rec.name || !rec.value){ alert("Preencha nome e valor."); return; }
    const { error } = await sb.from("assets").insert(rec);
    if (error) return alert(error.message);
    closeModal(); navigate("patrimonio");
  });
}

// ---------------------------------------------------------------------
// VIEW: INVESTIMENTOS (carteira)
// ---------------------------------------------------------------------
async function viewInvestimentos(){
  const inv = await fetchAll("investments");
  const total = inv.reduce((s,a)=>s+Number(a.value),0);
  // agrupa por classe
  const byClass = {};
  inv.forEach(i=>{ const k=i.asset_class||"Outros"; byClass[k]=(byClass[k]||0)+Number(i.value); });

  $("#view-container").innerHTML = `
    <div class="grid cards-2">
      <div class="card"><div class="label">Investimentos totais</div><div class="big blue">${BRL(total)}</div></div>
      <div class="card">
        <h3>Alocação por classe</h3>
        <canvas id="inv-chart" height="180"></canvas>
      </div>
    </div>

    <div class="toolbar" style="margin-top:22px">
      <button class="btn primary" id="add-inv">+ Adicionar ativo</button>
    </div>

    <table>
      <thead><tr><th>Produto</th><th>Classe</th><th>Categoria</th><th>Instituição</th>
        <th style="text-align:right">Saldo</th><th></th></tr></thead>
      <tbody>
        ${inv.length===0 ? `<tr><td colspan="6" class="empty">Nenhum ativo na carteira.</td></tr>`
        : inv.map(i=>`<tr>
          <td><b>${escapeHtml(i.product)}</b></td>
          <td>${escapeHtml(i.asset_class||"—")}</td>
          <td class="muted">${escapeHtml(i.category||"—")}</td>
          <td class="muted">${escapeHtml(i.institution||"—")}</td>
          <td style="text-align:right"><b>${BRL(i.value)}</b></td>
          <td class="row-actions"><button data-del-inv="${i.id}">🗑</button></td>
        </tr>`).join("")}
      </tbody>
    </table>
  `;

  $("#add-inv").addEventListener("click", openInvModal);
  $$("[data-del-inv]").forEach(b=> b.addEventListener("click", ()=> delRow("investments", b.dataset.delInv)));

  const labels = Object.keys(byClass);
  if (labels.length){
    const c = new Chart($("#inv-chart"), {
      type:"doughnut",
      data:{ labels, datasets:[{ data:labels.map(l=>byClass[l]),
        backgroundColor:["#2f6df6","#7c3aed","#16a34a","#f59e0b","#e0405a","#7aa7e0","#06b6d4"],
        borderWidth:0 }] },
      options:{ cutout:"60%", plugins:{legend:{position:"right"}} }
    });
    chartRefs.push(c);
  }
}

function openInvModal(){
  openModal("Adicionar ativo", `
    <div class="form-grid">
      <label>Produto</label><input id="i-prod" placeholder="Ex: Tesouro IPCA+ 2040">
      <label>Classe do ativo</label>
      <select id="i-class"><option>Renda fixa</option><option>Ações</option>
        <option>Título público</option><option>CDB</option><option>BDRs</option>
        <option>Fundos</option><option>Cripto</option><option>Outros</option></select>
      <label>Categoria</label>
      <select id="i-cat"><option>Renda fixa</option><option>Renda variável</option></select>
      <label>Instituição</label><input id="i-inst" placeholder="Ex: Nubank, Rico...">
      <label>Saldo investido (R$)</label><input id="i-value" type="number" step="0.01" min="0">
      <button class="btn primary" id="i-save">Salvar</button>
    </div>
  `);
  $("#i-save").addEventListener("click", async ()=>{
    const rec = { product:$("#i-prod").value.trim(), asset_class:$("#i-class").value,
      category:$("#i-cat").value, institution:$("#i-inst").value.trim(),
      value:parseFloat($("#i-value").value||"0") };
    if (!rec.product || !rec.value){ alert("Preencha produto e saldo."); return; }
    const { error } = await sb.from("investments").insert(rec);
    if (error) return alert(error.message);
    closeModal(); navigate("investimentos");
  });
}

// ---------------------------------------------------------------------
// VIEW: CONTAS
// ---------------------------------------------------------------------
async function viewContas(){
  const accs = await fetchAll("accounts");
  const contas = accs.filter(a=>a.kind==="conta");
  const cartoes = accs.filter(a=>a.kind==="cartao");
  const totalCC = contas.reduce((s,a)=>s+Number(a.balance),0);
  const totalInv = contas.reduce((s,a)=>s+Number(a.invested),0);
  const limiteTotal = cartoes.reduce((s,a)=>s+Number(a.credit_limit),0);
  const usadoTotal = cartoes.reduce((s,a)=>s+Number(a.used),0);

  $("#view-container").innerHTML = `
    <div class="grid cards-2" style="align-items:start">
      <div>
        <div class="toolbar"><h3 style="margin:0;flex:1">Contas</h3>
          <button class="btn primary" data-add-acc="conta">+ Conta</button></div>
        <div class="card"><div class="budget-sub"><span>Total em conta corrente</span><b>${BRL(totalCC)}</b></div>
          <div class="budget-sub"><span>Total em investimentos</span><b>${BRL(totalInv)}</b></div></div>
        ${contas.map(a=>`<div class="card" style="margin-top:12px">
          <div class="budget-name"><b>${escapeHtml(a.name)}</b>
            <button class="row-actions" style="border:none;background:none" data-del-acc="${a.id}">🗑</button></div>
          <div class="muted" style="font-size:13px">${escapeHtml(a.institution||"")}</div>
          <div class="budget-sub" style="margin-top:8px"><span>Conta corrente</span><span>${BRL(a.balance)}</span></div>
          <div class="budget-sub"><span>Investimentos</span><span>${BRL(a.invested)}</span></div>
        </div>`).join("") || `<p class="hint">Nenhuma conta cadastrada.</p>`}
      </div>

      <div>
        <div class="toolbar"><h3 style="margin:0;flex:1">Cartões</h3>
          <button class="btn primary" data-add-acc="cartao">+ Cartão</button></div>
        <div class="card"><div class="budget-sub"><span>Total utilizado</span><b>${BRL(usadoTotal)} de ${BRL(limiteTotal)}</b></div>
          <div class="budget-sub"><span>Limite disponível</span><b>${BRL(limiteTotal-usadoTotal)}</b></div></div>
        ${cartoes.map(a=>{
          const pct = a.credit_limit? Math.min(100, a.used/a.credit_limit*100):0;
          return `<div class="card" style="margin-top:12px">
            <div class="budget-name"><b>${escapeHtml(a.name)}</b>
              <button class="row-actions" style="border:none;background:none" data-del-acc="${a.id}">🗑</button></div>
            <div class="muted" style="font-size:13px">${escapeHtml(a.institution||"")}</div>
            <div class="budget-bar" style="margin-top:10px"><div class="${pct>90?'over':''}" style="width:${pct}%"></div></div>
            <div class="budget-sub" style="margin-top:6px"><span>${BRL(a.used)} (${pct.toFixed(0)}%)</span><span>Limite ${BRL(a.credit_limit)}</span></div>
          </div>`;
        }).join("") || `<p class="hint">Nenhum cartão cadastrado.</p>`}
      </div>
    </div>
  `;

  $$("[data-add-acc]").forEach(b=> b.addEventListener("click", ()=> openAccModal(b.dataset.addAcc)));
  $$("[data-del-acc]").forEach(b=> b.addEventListener("click", ()=> delRow("accounts", b.dataset.delAcc)));
}

function openAccModal(kind){
  const isCard = kind==="cartao";
  openModal(`Adicionar ${isCard?"cartão":"conta"}`, `
    <div class="form-grid">
      <label>Nome</label><input id="ac-name" placeholder="${isCard?'Ex: Nubank Black':'Ex: Nubank - Lucas'}">
      <label>Instituição</label><input id="ac-inst" placeholder="Ex: Nubank">
      ${isCard ? `
        <label>Limite total (R$)</label><input id="ac-limit" type="number" step="0.01" min="0">
        <label>Valor utilizado (R$)</label><input id="ac-used" type="number" step="0.01" min="0">
      `:`
        <label>Saldo em conta corrente (R$)</label><input id="ac-bal" type="number" step="0.01" min="0">
        <label>Investimentos (R$)</label><input id="ac-inv" type="number" step="0.01" min="0">
      `}
      <button class="btn primary" id="ac-save">Salvar</button>
    </div>
  `);
  $("#ac-save").addEventListener("click", async ()=>{
    const rec = { name:$("#ac-name").value.trim(), institution:$("#ac-inst").value.trim(), kind };
    if (isCard){ rec.credit_limit=parseFloat($("#ac-limit").value||"0"); rec.used=parseFloat($("#ac-used").value||"0"); }
    else { rec.balance=parseFloat($("#ac-bal").value||"0"); rec.invested=parseFloat($("#ac-inv").value||"0"); }
    if (!rec.name){ alert("Informe um nome."); return; }
    const { error } = await sb.from("accounts").insert(rec);
    if (error) return alert(error.message);
    closeModal(); navigate("contas");
  });
}

// ---------------------------------------------------------------------
// Excluir genérico + Modal helpers
// ---------------------------------------------------------------------
async function delRow(table, id){
  if (!confirm("Excluir este item?")) return;
  const { error } = await sb.from(table).delete().eq("id", id);
  if (error) return alert(error.message);
  navigate(state.view);
}

function openModal(title, html){
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = html;
  $("#modal").style.display = "flex";
}
function closeModal(){ $("#modal").style.display = "none"; $("#modal-body").innerHTML=""; }
$("#modal-close").addEventListener("click", closeModal);
$("#modal").addEventListener("click", (e)=>{ if(e.target.id==="modal") closeModal(); });

// ---------------------------------------------------------------------
// Dados de exemplo
// ---------------------------------------------------------------------
async function seedSampleData(){
  if (!confirm("Carregar dados de exemplo (contas, patrimônio e lançamentos)?")) return;
  const mk = monthKey();
  const tx = [
    ["Salário","Renda","entrada",18000,"01"],
    ["Freelance","Renda","entrada",4000,"05"],
    ["Aluguel","Casa","saida",2500,"05"],
    ["Mercado São Luiz","Mercado","saida",860,"06"],
    ["Restaurante","Restaurantes","saida",420,"08"],
    ["Uber","Transporte","saida",205,"09"],
    ["Drogasil","Saúde","saida",180,"10"],
    ["Netflix + Spotify","Assinaturas e serviços","saida",90,"10"],
    ["Academia","Esportes","saida",260,"11"],
    ["Cinema","Lazer","saida",120,"12"],
  ].map(([est,cat,type,amt,day])=>({
    date:`${mk}-${day}`, establishment:est, category:cat, type, amount:amt,
    payment_method:"Cartão final 8228"
  }));
  const assets = [
    { name:"Nubank - Lucas", category:"investimento", value:157523.44, income_generating:true },
    { name:"Rico Investimentos", category:"investimento", value:3968.96, income_generating:true },
    { name:"Carro", category:"bem_movel", value:107500, income_generating:false },
  ];
  const accounts = [
    { name:"Nubank - Lucas", institution:"Nubank", kind:"conta", balance:179.40, invested:157523.44 },
    { name:"C6 Bank - Lucas", institution:"C6 Bank", kind:"conta", balance:657.10, invested:0 },
    { name:"Nubank Black 4549", institution:"Nubank", kind:"cartao", credit_limit:3000, used:244.80 },
    { name:"C6 Mastercard 0200", institution:"C6 Bank", kind:"cartao", credit_limit:21000, used:6039.87 },
  ];
  const investments = [
    { product:"Tesouro IPCA+ 2040", asset_class:"Título público", category:"Renda fixa", institution:"Rico", value:744.56 },
    { product:"CDB Nu Financeira", asset_class:"CDB", category:"Renda fixa", institution:"Nubank", value:157510.89 },
    { product:"RAIZ4", asset_class:"Ações", category:"Renda variável", institution:"Rico", value:2969.14 },
  ];
  const budgets = [
    ["Casa",2500],["Mercado",1000],["Restaurantes",500],["Transporte",1100],
    ["Saúde",800],["Lazer",1200],["Esportes",1500],["Assinaturas e serviços",430],
  ].map(([category,planned])=>({ month:mk, category, planned, icon:catIcon(category) }));

  try{
    await sb.from("transactions").insert(tx);
    await sb.from("assets").insert(assets);
    await sb.from("accounts").insert(accounts);
    await sb.from("investments").insert(investments);
    await sb.from("budgets").upsert(budgets, { onConflict:"user_id,month,category" });
    alert("Dados de exemplo carregados!");
    navigate("home");
  }catch(err){ alert("Erro ao carregar exemplo: "+err.message); }
}

// ---------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------
initSupabase();
