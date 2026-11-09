"""Build data/econ485.js for the site from the ECON 485 Governors' Challenge outputs.

Reads the forecasting outputs in ~/Documents/ECON485 and writes one JS file that
sets window.GC. Run from the portfolio folder:

    python3 scripts/build_econ485.py
"""

import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path.home() / "Documents" / "ECON485"
FC = ROOT / "forecasting" / "output"
CACHE = ROOT / "forecasting" / "data_cache"
OUT = Path(__file__).resolve().parents[1] / "data" / "econ485.js"

MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def rows(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def ym(label):
    """'2026 Jul' or '2026-07-01' or '2026-07' -> '2026-07'."""
    label = label.strip()
    if " " in label:
        y, m = label.split()
        return f"{y}-{MONTHS.index(m[:3]) + 1:02d}"
    return label[:7]


def r(x, n=3):
    try:
        return round(float(x), n)
    except (TypeError, ValueError):
        return None


def yoy_monthly(path, start="2019-01"):
    vals = {ym(d["date"]): float(d["value"]) for d in rows(path) if d["value"] not in ("", "NA")}
    keys = sorted(vals)
    out = []
    for k in keys:
        y, m = k.split("-")
        prev = f"{int(y) - 1}-{m}"
        if k >= start and prev in vals:
            out.append([k, r(100 * (vals[k] / vals[prev] - 1), 2)])
    return out


def level_monthly(path, start="2019-01"):
    return [[ym(d["date"]), r(d["value"], 2)] for d in rows(path)
            if d["value"] not in ("", "NA") and ym(d["date"]) >= start]


def gdp_quarterly_as_monthly(path, start="2019-01"):
    """Quarterly real GDP y/y, placed on the quarter's middle month."""
    vals = {ym(d["date"]): float(d["value"]) for d in rows(path) if d["value"] not in ("", "NA")}
    out = []
    for k in sorted(vals):
        y, m = k.split("-")
        prev = f"{int(y) - 1}-{m}"
        if prev in vals:
            mid = f"{y}-{int(m) + 1:02d}"
            if mid >= start:
                out.append([mid, r(100 * (vals[k] / vals[prev] - 1), 2)])
    return out


# ---------------------------------------------------------------- history
history = {
    "cpi": yoy_monthly(CACHE / "statcan_v41690914.csv"),
    "unemp": level_monthly(CACHE / "statcan_v2062815.csv"),
    "gdp": gdp_quarterly_as_monthly(CACHE / "statcan_v62305752.csv"),
}

# ---------------------------------------------------------------- forecasts (restricted BVAR, final)
fc = defaultdict(lambda: defaultdict(list))
for d in rows(FC / "27_restricted_bvar" / "6_forecasts.csv"):
    fc[d["case"]][d["series"]].append(
        [ym(d["date"]), r(d["lo95"], 2), r(d["lo80"], 2), r(d["median"], 2), r(d["hi80"], 2), r(d["hi95"], 2)]
    )
cases = list(fc.keys())

annual = defaultdict(dict)
for d in rows(FC / "27_restricted_bvar" / "6_annual_averages.csv"):
    annual[d["case"]][f'{d["series"]}|{d["period"]}'] = r(d["value"], 1)

# ---------------------------------------------------------------- conditioning paths (outside variables)
paths = defaultdict(lambda: defaultdict(list))
for d in rows(FC / "27_restricted_bvar" / "7_monthly_paths.csv"):
    paths[d["case"]][d["series"]].append([ym(d["date"]), r(d["value"], 3)])

# ---------------------------------------------------------------- horse race
race = defaultdict(lambda: defaultdict(dict))
for d in rows(FC / "31_horse_race" / "rmse_all.csv"):
    race[d["model"]][d["target"]][int(d["h"])] = r(d["rel"], 3)
summary = [
    {k: v for k, v in d.items()} for d in rows(FC / "31_horse_race" / "summary_table.csv")
]

# ---------------------------------------------------------------- marginal likelihood surface
ml = rows(FC / "25_bvar_by_hand" / "5_marginal_likelihood_grid.csv")
lam = sorted({float(d["lambda"]) for d in ml})
lamx = sorted({float(d["lambda_x"]) for d in ml})
grid = {(float(d["lambda"]), float(d["lambda_x"])): float(d["log_ml"]) for d in ml}
ml_surface = {
    "lambda": lam,
    "lambda_x": lamx,
    "z": [[r(grid.get((a, b)), 2) for a in lam] for b in lamx],  # rows = lambda_x
}

# ---------------------------------------------------------------- Taylor rule
# Recover the long-run rule (target = c + phi_pi*inflation + phi_u*gap) from 24's output.
tr = rows(FC / "24_taylor_rule" / "rule_vs_our_paths.csv")
X = [[1.0, float(d["inflation"]), float(d["gap"])] for d in tr]
y = [float(d["target"]) for d in tr]


def solve_ols(X, y):
    k = len(X[0])
    xtx = [[sum(row[i] * row[j] for row in X) for j in range(k)] for i in range(k)]
    xty = [sum(row[i] * yy for row, yy in zip(X, y)) for i in range(k)]
    # Gauss-Jordan
    a = [xtx[i] + [xty[i]] for i in range(k)]
    for c in range(k):
        p = max(range(c, k), key=lambda i: abs(a[i][c]))
        a[c], a[p] = a[p], a[c]
        for i in range(k):
            if i != c:
                f = a[i][c] / a[c][c]
                a[i] = [ai - f * ac for ai, ac in zip(a[i], a[c])]
    return [a[i][k] / a[i][i] for i in range(k)]


c0, phi_pi, phi_u = solve_ols(X, y)
taylor = {
    "const": r(c0, 4),
    "phi_pi": r(phi_pi, 4),
    "phi_u": r(phi_u, 4),
    "neutral": r(c0 + phi_pi * 2, 3),
    "unemp_long_run": 6.5,
}

# ---------------------------------------------------------------- oil shock CPI decomposition
contrib = []
for d in rows(ROOT / "output" / "T7_cpi_contributions_tariff.csv"):
    if d["version"] != "main":
        continue
    contrib.append({
        "m": d["month"],
        "energy": r(d["Direct energy"]),
        "indirect": r(d["Indirect energy exposure"]),
        "insulated": r(d["Insulated"]),
        "tariff": r(d["Tariff-exposed"]),
        "cpi": r(d["allitems_yoy"], 2),
    })
brent = {ym(d["month"]): r(d["brent_cad"], 1) for d in rows(ROOT / "data" / "brent_fx_monthly.csv")}
for c in contrib:
    c["brent"] = brent.get(c["m"])

# ---------------------------------------------------------------- price distributions (ridgelines)
# CPI: 49 components, grouped as in the T7 chart (direct energy, indirect energy, counter-tariff, insulated).
T7_GROUP = {
    "Direct energy": "energy",
    "Indirect energy exposure": "indirect",
    "Tariff-exposed": "tariff",
    "Insulated": "insulated",
}
cpi_group = {d["cpi_component"]: T7_GROUP.get(d["main"], "insulated") for d in rows(ROOT / "output" / "T7_component_groups.csv")}
# The distribution file excludes direct energy, so energy items are added back from the component
# file (effective shares, as in the diffusion measure); its last month (Sep 2026) comes from the
# item table. Non-energy weights are scaled so each month sums to one.
non_energy = defaultdict(list)
for d in rows(ROOT / "output" / "oil_shock_inflation_distribution.csv"):
    g = cpi_group.get(d["component"]) or ("energy" if d["group"] == "direct" else d["group"])
    non_energy[d["month"][:7]].append([float(d["yoy"]), float(d["weight"]), g, d["component"]])
energy = defaultdict(dict)
for d in rows(ROOT / "data" / "results" / "component_yoy.csv"):
    if d["group"] == "direct energy":
        energy[d["month"][:7]][d["component"]] = [float(d["yoy"]), float(d["eff_share_t12"]) / 100]
last_e = energy[max(energy)]
for d in rows(ROOT / "output" / "oil_shock_item_table.csv"):
    if d["group"] == "Direct energy" and d["item"] in last_e:
        energy.setdefault("2026-09", {})[d["item"]] = [float(d["yoy_sep2026"]), last_e[d["item"]][1]]
dist_cpi = {}
for m, items in non_energy.items():
    e = energy.get(m, {})
    e_share = sum(v[1] for v in e.values())
    dist_cpi[m] = [[r(y, 2), r(w * (1 - e_share), 5), g, c] for y, w, g, c in items] + [
        [r(v[0], 2), r(v[1], 5), "energy", c] for c, v in e.items()
    ]

# IPPI: product groups weighted by their share of industrial output.
dist_ippi = defaultdict(list)
for d in rows(ROOT / "output" / "ippi_price_distribution_energy.csv"):
    g = "energy" if d["energy"] == "TRUE" else "tariff" if d["tariff"] == "TRUE" else "indirect" if d["indirect"] == "TRUE" else "insulated"
    dist_ippi[d["month"][:7]].append([r(d["yoy"], 2), r(float(d["share_pct"]) / 100, 5), g, d["component"]])

# ---------------------------------------------------------------- housing (Kalathmi Charts, ECON 485 report)
OUT_DIR = ROOT / "output"
housing = {
    "balance": [[ym(d["date"]), r(d["inventory"], 2), r(d["ratio"], 1)] for d in rows(OUT_DIR / "housing_market_balance.csv")],
    "shelter": [
        [ym(d["month"]), r(d["shelter_total"]), r(d["Mortgage interest cost"]), r(d["Rented accommodation"]),
         r(d["Other owned accommodation"]), r(d["Water, fuel and electricity"])]
        for d in rows(OUT_DIR / "inflation_shelter_contributions.csv")
    ],
    "starts": [
        [d["date"], r(d["level_Multiples"], 1), r(d["level_Single-detached"], 1), r(d["New 5-year fixed mortgages"], 2), r(d["Prime rate"], 2)]
        for d in rows(OUT_DIR / "housing_starts_rates.csv") if d["date"] >= "2021"
    ],
}
fixed_var = {ym(d["date"]): d for d in rows(OUT_DIR / "housing_mortgage_rates_variable_fixed.csv")}
housing["rates"] = [
    [ym(d["date"]), r(d["New mortgages"], 2), r(d["All outstanding mortgages"], 2),
     r(fixed_var.get(ym(d["date"]), {}).get("rate_fixed"), 2), r(fixed_var.get(ym(d["date"]), {}).get("rate_variable"), 2)]
    for d in rows(OUT_DIR / "housing_mortgage_rates_new_vs_outstanding.csv")
]

data = {
    "housing": housing,
    "dist": {"cpi": dist_cpi, "ippi": dist_ippi},
    "history": history,
    "cases": cases,
    "forecast": fc,
    "annual": annual,
    "paths": paths,
    "race": race,
    "raceSummary": summary,
    "ml": ml_surface,
    "taylor": taylor,
    "contrib": contrib,
}

OUT.parent.mkdir(exist_ok=True)
OUT.write_text(
    "/* Generated by scripts/build_econ485.py from the ECON 485 Governors' Challenge outputs. */\n"
    "window.GC = " + json.dumps(data, separators=(",", ":")) + ";\n"
)
print("wrote", OUT, OUT.stat().st_size, "bytes")
print("cases:", cases)
print("taylor:", taylor)
print("history ends:", {k: v[-1] for k, v in history.items()})
print("race models:", list(race))
