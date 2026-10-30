# Courtside dashboard

Public page for Courtside, a Kalshi trading system (Courtside NBA and Markov Tennis):
**https://jeddy-xie.github.io/courtside-dashboard/**

- `index.html` shows P&L and trades in dollars per $100 put in.
- `pipeline.html` shows how a hypothesis becomes a trading system, and where each system stands.

**Mock vs real.** Until real-money trading starts, the dashboard shows a labelled, seeded simulation (`assets/mock.js`). It has no edge built in. Everything on the pipeline page is real.

**How it updates.** `tools/update_live.py` opens the private Courtside repo's real-money ledgers read-only and writes `data/live.json`. Once any closed real trade exists, the page switches from mock to real by itself. A daily job on the owner's machine runs the script with `--push`.

**Why the source repo is private.** Kalshi's Developer Agreement (§3.1) bars sharing market data obtained through its API. Only the owner's own fills and settlements are published here.
