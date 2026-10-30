#!/usr/bin/env python3
"""Refresh data/live.json from Courtside's real-money ledgers, then optionally commit and push.

The dashboard shows mock data until data/live.json says mode "real". This script sets it as soon as either
real-money ledger holds a closed position:
    NBA     <kalshi>/data/ledger.db
    tennis  <kalshi>/data/tennis/ledger-prod.db
Demo ledgers are never read. Ledgers are opened read-only (append-only SQLite, `events` table). Only your own fills
and settlements leave the machine: no order books or other Kalshi market data (Developer Agreement §3.1).

Money put in follows Kalshi/docs/status/per100.py: the cost of the contracts each fill opened (YES bought at p costs
p; a NO, or a YES sold, ties up 1 - p). Closing fills add nothing. P&L = payout - (all fills' cost + fees).

Usage: update_live.py [--kalshi ~/Kalshi] [--site <this repo>] [--push]
"""
from __future__ import annotations

import argparse, ast, datetime as dt, json, sqlite3, subprocess, sys
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
LEDGERS = {"nba": "data/ledger.db", "tennis": "data/tennis/ledger-prod.db"}


def gate_rule_count(kalshi: Path) -> int | None:
    """len(RULES) from courtside/risk/gate.py, read with ast so nothing is imported or run."""
    try:
        for node in ast.parse((kalshi / "courtside/risk/gate.py").read_text()).body:
            if isinstance(node, ast.Assign) and any(getattr(t, "id", "") == "RULES" for t in node.targets):
                return len(ast.literal_eval(node.value))
    except (OSError, SyntaxError, ValueError):
        pass
    return None


def read_events(db: Path) -> list[tuple]:
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        return con.execute("SELECT ts, kind, payload FROM events WHERE kind IN ('fill', 'settlement') ORDER BY ts, id").fetchall()
    finally:
        con.close()


def positions(sys_key: str, rows: list[tuple]) -> list[dict]:
    """One row per market: opened, closed (flat or settled), valued. Open positions are left out."""
    by, settled = {}, {}
    for ts, kind, payload in rows:
        p = json.loads(payload)
        if kind == "settlement":
            settled[p["ticker"]] = p["result"]
        else:
            by.setdefault(p["ticker"], []).append((ts, p))
    out = []
    for tk, fills in by.items():
        net = Decimal(0)                                   # signed YES position
        put_in = opened = cost = fees = Decimal(0)
        yes_held = no_held = Decimal(0)
        close_val = close_n = Decimal(0)
        first_side = maker = None
        for ts, f in fills:
            c, px = Decimal(str(f["count"])), Decimal(str(f["price"]))
            yes_px = px if f["side"] == "yes" else 1 - px
            d = c if (f["side"] == "yes") == (f["action"] == "buy") else -c
            before, after = net, net + d
            held_yes = d > 0                               # this fill is, in effect, a YES purchase
            paid = yes_px if held_yes else 1 - yes_px
            cost += c * paid
            fees += Decimal(str(f["fee"]))
            yes_held, no_held = (yes_held + c, no_held) if held_yes else (yes_held, no_held + c)
            n_open = max(Decimal(0), abs(after) - abs(before))
            if n_open:
                put_in += n_open * (yes_px if after > 0 else 1 - yes_px)
                opened += n_open
                if first_side is None:
                    first_side, maker = ("YES" if after > 0 else "NO"), not f["is_taker"]
            n_close = min(c, abs(before)) if (before != 0 and (before > 0) != (d > 0)) else Decimal(0)
            if n_close:                                    # exit price in the held side's terms
                close_val += n_close * (yes_px if before > 0 else 1 - yes_px)
                close_n += n_close
            net = after
        res = settled.get(tk)
        if res == "void" or opened == 0:
            continue
        if res in ("yes", "no"):
            payout = yes_held if res == "yes" else no_held
        elif net == 0:
            payout = yes_held                              # flat: each YES+NO pair is a locked $1
        else:
            continue                                       # still open: not realised
        held_to_settle = res in ("yes", "no") and net != 0
        settle_val = Decimal(1) if (res == "yes") == (first_side == "YES") else Decimal(0)
        exit_px = settle_val if held_to_settle else close_val / close_n
        out.append({
            "sys": sys_key, "date": dt.datetime.fromtimestamp(fills[0][0] / 1e9, ET).date().isoformat(), "market": tk,
            "side": first_side, "qty": float(opened), "entry": float(round(put_in / opened, 4)), "exit": float(round(exit_px, 4)),
            "settle": held_to_settle, "maker": bool(maker), "fees": float(round(fees, 2)), "put_in": float(round(put_in, 2)),
            "pnl": float(round(payout - cost - fees, 2)),
        })
    return out


def build(kalshi: Path) -> dict:
    trades, any_fill = [], False
    for k, rel in LEDGERS.items():
        db = kalshi / rel
        if db.exists():
            rows = read_events(db)
            any_fill |= any(r[1] == "fill" for r in rows)
            trades += positions(k, rows)
    trades.sort(key=lambda t: (t["date"], t["sys"], t["market"]))
    facts = {"realMoney": "Live" if any_fill else "Locked"}
    n = gate_rule_count(kalshi)
    if n:
        facts["gateRules"] = n
    return {"schema": 1, "mode": "real" if trades else "mock", "facts": facts, "trades": trades}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--kalshi", type=Path, default=Path.home() / "Kalshi")
    ap.add_argument("--site", type=Path, default=Path(__file__).resolve().parents[1])
    ap.add_argument("--push", action="store_true", help="commit and push data/live.json if it changed")
    a = ap.parse_args()
    doc = build(a.kalshi)
    out = a.site / "data/live.json"
    old = json.loads(out.read_text()) if out.exists() else {}
    old.pop("generated_utc", None)
    if old == doc:
        print(f"unchanged: mode {doc['mode']}, {len(doc['trades'])} closed trades")
        return 0
    doc["generated_utc"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(doc, indent=1) + "\n")
    print(f"wrote {out}: mode {doc['mode']}, {len(doc['trades'])} closed trades, real money {doc['facts']['realMoney']}")
    if a.push:
        git = ["git", "-C", str(a.site)]
        subprocess.run(git + ["add", "data/live.json"], check=True)
        subprocess.run(git + ["commit", "-q", "-m", f"data: live.json ({doc['mode']}, {len(doc['trades'])} trades)"], check=True)
        subprocess.run(git + ["push", "-q"], check=True)
        print("pushed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
