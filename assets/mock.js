// MOCK trades and P&L, generated in the browser from a fixed seed so every visitor sees the same numbers.
// Mechanics follow the real system (Kalshi fee formula, 5-contract orders, $50 daily loss cap, $5 tennis stakes),
// but the outcomes are random draws with no edge built in: EDGE_CENTS = 0 means price moves are pure noise,
// so expected P&L is minus fees. Change EDGE_CENTS only if the page says so.
const MOCK = (() => {
  const SEED = 20261020, DAYS = 30, EDGE_CENTS = 0;
  let s = SEED >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const norm = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const pois = (l) => { let k = 0, p = 1, L = Math.exp(-l); do { k++; p *= rnd(); } while (p > L); return k - 1; };
  const cent = (x) => Math.min(0.99, Math.max(0.01, Math.round(x * 100) / 100));
  // Kalshi trading fee: ceil to the cent of rate * C * P * (1 - P); taker 0.07, maker 0.0175
  const fee = (c, p, maker) => Math.ceil((maker ? 0.0175 : 0.07) * c * p * (1 - p) * 100 - 1e-9) / 100;

  function trade(sys, day, i) {
    const p = cent(sys === "nba" ? 0.25 + 0.5 * rnd() : 0.3 + 0.5 * rnd());
    const qty = sys === "nba" ? 1 + Math.floor(rnd() * 5) : Math.max(1, Math.floor(5 / p));
    const maker = rnd() < 0.45, side = rnd() < 0.5 ? "YES" : "NO";
    const settle = rnd() < 0.3;
    let exit;
    if (settle) exit = rnd() < p + EDGE_CENTS / 100 ? 1 : 0;
    else exit = cent(p + EDGE_CENTS / 100 + norm() * (sys === "nba" ? 0.07 : 0.09));
    const fees = fee(qty, p, maker) + (settle ? 0 : fee(qty, exit, false));
    const pnl = Math.round((qty * (exit - p) - fees) * 100) / 100;
    const n = String(Math.floor(rnd() * 90) + 10).padStart(3, "0");
    const market = sys === "nba" ? `MOCK-NBAGAME-G${n}-${rnd() < 0.5 ? "HOME" : "AWAY"}` : `MOCK-ATPMATCH-M${n}-P${rnd() < 0.5 ? 1 : 2}`;
    // money put in = cost of the contracts opened (Kalshi/docs/status/per100.py): qty x price of the side bought
    return { sys, day, i, market, side, qty, entry: p, exit, maker, settle, fees: Math.round(fees * 100) / 100, pnl,
             put_in: Math.round(qty * p * 100) / 100,
             gate: `${FACTS.gateRules}/${FACTS.gateRules}` };
  }

  const trades = [];
  for (let d = 1; d <= DAYS; d++) {
    let dayLoss = 0;
    const nN = pois(2.2), nT = pois(1.3);
    for (let i = 0; i < nN; i++) {
      if (dayLoss <= -FACTS.limits.dailyLossCap) break;      // the $50 daily cap halts the day
      const t = trade("nba", d, i); trades.push(t); dayLoss += t.pnl;
    }
    for (let i = 0; i < nT; i++) trades.push(trade("tennis", d, i));
  }
  return { trades, days: DAYS, seed: SEED, edge: EDGE_CENTS };
})();
