import type { MacroObservation, MacroSource } from "./macroObservations.js";

export type MacroScale = {
  score: number;
  inverted: boolean;
  reason: string;
};

export type MacroIndexLeg = {
  id: MacroSource;
  raw: number | null;
  score: number | null;
  weight: number;
  inverted: boolean;
  included: boolean;
  reason: string;
};

export type OverviewMacroIndex = {
  score: number;
  label: "Strong bear" | "Bear" | "Neutral" | "Bull" | "Strong bull";
  conflicted: boolean;
  asOf: string;
  legs: MacroIndexLeg[];
};

const WEIGHTS: Record<MacroSource, number> = {
  sp500: 0.3,
  coingecko: 0.175,
  cmc: 0.075,
  ovx: 0.15,
  gpr: 0.15,
  gold: 0.15,
  news_mix: 0.05,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function score10(value: number): number {
  return Number(clamp(value, 1, 10).toFixed(1));
}

export function scaleDirectional(value: number, name = "directional signal"): MacroScale {
  return {
    score: score10(5 + 5 * clamp(value, -1, 1)),
    inverted: false,
    reason: `${name} mapped from -1…+1`,
  };
}

export function scaleFearGreed(value: number): MacroScale {
  let score = 2.5;
  let bucket = "Extreme Greed";
  if (value <= 25) {
    score = 7.5;
    bucket = "Extreme Fear";
  } else if (value <= 44) {
    score = 6;
    bucket = "Fear";
  } else if (value <= 55) {
    score = 5;
    bucket = "Neutral";
  } else if (value <= 74) {
    score = 4.5;
    bucket = "Greed";
  }
  return {
    score,
    inverted: true,
    reason: `${bucket} treated as a contrarian week-ahead signal`,
  };
}

export function scaleOvx(value: number): MacroScale {
  return {
    score: score10(10 - 9 * clamp(value / 80, 0, 1)),
    inverted: true,
    reason: "oil volatility inverted: higher stress is risk-off",
  };
}

export function scaleGpr(value: number): MacroScale {
  return {
    score: score10(5 - 4 * clamp((value - 100) / 150, -1, 1)),
    inverted: true,
    reason: "geopolitical risk inverted around its long-run 100 baseline",
  };
}

export function scaleWeeklyReturn(value: number, sigma: number, name: string): MacroScale {
  return {
    score: score10(5 + 5 * Math.tanh(value / sigma)),
    inverted: false,
    reason: `${name} weekly return ${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`,
  };
}

export function scaleGold(
  weeklyReturn: number,
  context: { ovxScore: number | null; gprScore: number | null; sp500Score: number | null },
): MacroScale & { weightMultiplier: number } {
  const raw = scaleWeeklyReturn(weeklyReturn, 0.02, "gold");
  if (
    (context.ovxScore !== null && context.ovxScore <= 4) ||
    (context.gprScore !== null && context.gprScore <= 4)
  ) {
    return {
      score: score10(11 - raw.score),
      inverted: true,
      reason: "gold inverted because macro stress makes strength a flight-to-safety signal",
      weightMultiplier: 1,
    };
  }
  if (context.sp500Score !== null && context.sp500Score >= 6) {
    return {
      ...raw,
      reason: "gold aligned with risk-on equities as a lower-weight liquidity signal",
      weightMultiplier: 0.5,
    };
  }
  if (context.sp500Score !== null && context.sp500Score <= 4) {
    return {
      score: score10(11 - raw.score),
      inverted: true,
      reason: "gold inverted because equities are risk-off",
      weightMultiplier: 1,
    };
  }
  return {
    score: 5,
    inverted: false,
    reason: "gold has no directional edge outside a clear stress or liquidity regime",
    weightMultiplier: 1,
  };
}

export function weeklyReturn(observations: MacroObservation[]): number | null {
  const rows = [...observations].sort((a, b) => b.asOf.getTime() - a.asOf.getTime());
  const latest = rows[0];
  if (!latest) {
    return null;
  }
  const baseline =
    rows[5] ??
    rows.find((row, index) => index > 0 && latest.asOf.getTime() - row.asOf.getTime() <= 7 * 86_400_000);
  if (!baseline || baseline.value <= 0) {
    return null;
  }
  return (latest.value - baseline.value) / baseline.value;
}

export function macroIndexLabel(score: number): OverviewMacroIndex["label"] {
  if (score <= 2.5) {
    return "Strong bear";
  }
  if (score < 4) {
    return "Bear";
  }
  if (score < 6) {
    return "Neutral";
  }
  if (score < 7.5) {
    return "Bull";
  }
  return "Strong bull";
}

function bySource(observations: MacroObservation[], source: MacroSource): MacroObservation[] {
  return observations.filter((row) => row.source === source);
}

function latest(observations: MacroObservation[], source: MacroSource): MacroObservation | null {
  return bySource(observations, source).sort((a, b) => b.asOf.getTime() - a.asOf.getTime())[0] ?? null;
}

function missingLeg(id: MacroSource, reason: string): MacroIndexLeg {
  return {
    id,
    raw: null,
    score: null,
    weight: WEIGHTS[id],
    inverted: false,
    included: false,
    reason,
  };
}

function scoredLeg(id: MacroSource, raw: number, scale: MacroScale, weight = WEIGHTS[id]): MacroIndexLeg {
  return {
    id,
    raw,
    score: scale.score,
    weight,
    inverted: scale.inverted,
    included: true,
    reason: scale.reason,
  };
}

export function buildMacroIndex(observations: MacroObservation[]): OverviewMacroIndex | null {
  const coingecko = latest(observations, "coingecko");
  const cmc = latest(observations, "cmc");
  const ovx = latest(observations, "ovx");
  const gpr = latest(observations, "gpr");
  const news = latest(observations, "news_mix");
  const sp500Rows = bySource(observations, "sp500");
  const goldRows = bySource(observations, "gold");

  const ovxScale = ovx ? scaleOvx(ovx.value) : null;
  const gprScale = gpr ? scaleGpr(gpr.value) : null;
  const sp500Return = weeklyReturn(sp500Rows);
  const sp500Scale = sp500Return === null ? null : scaleWeeklyReturn(sp500Return, 0.015, "S&P 500");
  const goldReturn = weeklyReturn(goldRows);

  const legs: MacroIndexLeg[] = [
    coingecko
      ? scoredLeg("coingecko", coingecko.value, scaleDirectional(coingecko.value, "CoinGecko sentiment"))
      : missingLeg("coingecko", "CoinGecko observation unavailable"),
    cmc
      ? scoredLeg("cmc", cmc.value, scaleFearGreed(cmc.value))
      : missingLeg("cmc", "fear and greed observation unavailable"),
    ovx && ovxScale
      ? scoredLeg("ovx", ovx.value, ovxScale)
      : missingLeg("ovx", "OVX observation unavailable"),
    gpr && gprScale
      ? scoredLeg("gpr", gpr.value, gprScale)
      : missingLeg("gpr", "GPR observation unavailable"),
    sp500Scale && sp500Return !== null
      ? scoredLeg("sp500", sp500Return, sp500Scale)
      : missingLeg("sp500", "at least two S&P 500 observations are required"),
  ];

  if (goldReturn === null) {
    legs.push(missingLeg("gold", "at least two gold observations are required"));
  } else {
    const goldScale = scaleGold(goldReturn, {
      ovxScore: ovxScale?.score ?? null,
      gprScore: gprScale?.score ?? null,
      sp500Score: sp500Scale?.score ?? null,
    });
    legs.push(scoredLeg("gold", goldReturn, goldScale, WEIGHTS.gold * goldScale.weightMultiplier));
  }

  legs.push(
    news
      ? scoredLeg("news_mix", news.value, scaleDirectional(news.value, "news mix"))
      : missingLeg("news_mix", "news mix observation unavailable"),
  );

  const included = legs.filter(
    (leg): leg is MacroIndexLeg & { score: number } => leg.included && leg.score !== null,
  );
  const weight = included.reduce((sum, leg) => sum + leg.weight, 0);
  if (weight <= 0) {
    return null;
  }
  const score = score10(included.reduce((sum, leg) => sum + leg.score * leg.weight, 0) / weight);
  const scores = included.map((leg) => leg.score);
  const conflicted = Math.max(...scores) - Math.min(...scores) >= 5;
  const newest = observations
    .filter((row) => included.some((leg) => leg.id === row.source))
    .sort((a, b) => b.asOf.getTime() - a.asOf.getTime())[0];

  return {
    score,
    label: conflicted ? "Neutral" : macroIndexLabel(score),
    conflicted,
    asOf: (newest?.asOf ?? new Date(0)).toISOString(),
    legs,
  };
}
