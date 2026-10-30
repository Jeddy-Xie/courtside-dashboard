// REAL figures only. Each one names the private-repo file it was read from (Kalshi/Courtside, status as of 25 Oct 2026).
// Nothing here is mock; mock data lives in mock.js and is labelled on the page.
const FACTS = {
  asOf: "25 Oct 2026",
  realMoney: "Locked",                       // docs/status: "No real-money key is installed"
  gateRules: 22,                             // courtside/risk/gate.py RULES
  limits: { contractsPerOrder: 5, dailyLossCap: 50, tennisStake: 5, tennisBankroll: 50 },  // docs/status steps 10
  nba: {
    games: 1235, plays: 598249, priceGames: 1375,   // docs/status step 1
    registered: 48, passed: 0, hurdle: 4.18, trials: 102,   // steps 2-4
    loopTested: 9, loopPassed: 0, loopHurdle: 4.21, loopTrials: 110,   // edge-hunting loop, first batch
    explore: 706, holdout: 481,                // "explores on the first 706 games ... confirms on the other 481"
    fillsAudited: 22792, fillErrors: 0,        // "22,792 simulated fills re-checked for price and fee: 0 errors"
    lookaheadDecisions: 76944, lookaheadChanged: 0,  // "swapping in a fake future changed 0 of 76,944 decisions"
  },
  tennis: {
    pbpMatches: 1375, pricedMatches: 10027, lowerTier: 38824,   // step 1
    rules: 4, settings: 160, passed: 0, hurdle: 4.39, trials: 190,   // steps 2-4; trials.TENNIS_N_AT_FREEZE
    nullCopies: 138, nullPassed: 0, minDetectable: "18.5¢ / match",  // step 3
    paperMatches: 75, paperTrades: 0,          // step 6, "since 23 Oct"
    sandboxLoss: 49.12,                        // step 8: in-play model rule lost $49.12 of the $50 limit -> rejected
  },
  // trials.hurdle(N) = max(3.4, E[max z of N] + 1.645), evaluated from courtside/nba/research/trials.py on 29 Oct 2026
  hurdleCurve: [[1,3.4],[10,3.4],[20,3.546],[30,3.718],[40,3.834],[50,3.921],[60,3.99],[80,4.096],[100,4.175],
                [120,4.239],[140,4.292],[160,4.337],[180,4.376],[200,4.41],[250,4.483],[300,4.54],[400,4.63]],
  // the eleven steps (docs/status "The full flow"); state per sport as of 25 Oct
  steps: [
    ["Data collected",          "done",  "done"],
    ["Ideas sealed in advance", "done",  "done"],
    ["Backtest + controls",     "done",  "done"],
    ["Pass the hurdle",         "block", "block"],
    ["Final exam (held-out)",   "none",  "block"],
    ["Paper trading",           "none",  "block"],
    ["Demo-money trading",      "none",  "block"],
    ["Sandbox certificate",     "none",  "block"],
    ["Owner sign-off",          "none",  "block"],
    ["Real money, small size",  "none",  "block"],
    ["Scale up",                "none",  "block"],
  ],
};
