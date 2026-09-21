import { holdingsCandles, holdingsScale, NEAR_HOLDINGS_GOAL_USD, type HoldingsCandle } from "../../../src/jobs/nearChart.js";
import { formatDeskStamp } from "@/lib/tz";

type Lot = {
  id: string;
  side: "entry" | "exit";
  at: string;
  tokens: number;
  value: number;
};

function formatUsd(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return n < 0 ? `−${abs.replace("$", "$")}` : abs;
}

function yOf(value: number, min: number, max: number, top: number, bottom: number): number {
  if (max === min) {
    return (top + bottom) / 2;
  }
  return bottom - ((value - min) / (max - min)) * (bottom - top);
}

export function NearHoldingsChart(props: { lots: Lot[] }) {
  const candles = holdingsCandles(props.lots);
  return (
    <>
      {candles.length === 0 ? <p className="empty-inline">Record entries and exits to chart holdings USD</p> : null}
      <CandlePlot candles={candles} />
    </>
  );
}

function CandlePlot(props: { candles: HoldingsCandle[] }) {
  const width = 960;
  const height = 220;
  const left = 72;
  const right = 12;
  const top = 12;
  const bottom = 32;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const { min, max } = holdingsScale(props.candles);
  const slot = props.candles.length === 0 ? plotW : plotW / props.candles.length;
  const bodyW = Math.max(4, Math.min(18, slot * 0.55));
  const ticks = [NEAR_HOLDINGS_GOAL_USD, NEAR_HOLDINGS_GOAL_USD / 2, min].filter(
    (tick, i, rows) => rows.indexOf(tick) === i,
  );
  const goalY = yOf(NEAR_HOLDINGS_GOAL_USD, min, max, top, top + plotH);
  const last = props.candles[props.candles.length - 1];
  const first = props.candles[0];

  return (
    <svg className="near-candles" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="NEAR holdings USD candles with 300k goal">
      {ticks.map((tick, i) => {
        const y = yOf(tick, min, max, top, top + plotH);
        return (
          <g key={`${tick}-${i}`}>
            <line className="near-candle-grid" x1={left} x2={width - right} y1={y} y2={y} />
            <text className="near-candle-axis" x={left - 8} y={y + 3} textAnchor="end">
              {formatUsd(tick)}
            </text>
          </g>
        );
      })}
      <line className="near-candle-goal" x1={left} x2={width - right} y1={goalY} y2={goalY} />
      <text className="near-candle-goal-label" x={width - right} y={goalY - 5} textAnchor="end">
        goal {formatUsd(NEAR_HOLDINGS_GOAL_USD)}
      </text>
      {props.candles.map((candle, i) => {
        const x = left + slot * i + slot / 2;
        const yHigh = yOf(candle.high, min, max, top, top + plotH);
        const yLow = yOf(candle.low, min, max, top, top + plotH);
        const yOpen = yOf(candle.open, min, max, top, top + plotH);
        const yClose = yOf(candle.close, min, max, top, top + plotH);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(2, Math.abs(yClose - yOpen));
        const up = candle.close >= candle.open;
        return (
          <g key={candle.id} className={up ? "near-candle-up" : "near-candle-down"}>
            <title>
              {`${candle.side} ${formatUsd(candle.lotValue)} · held ${formatUsd(candle.open)} → ${formatUsd(candle.close)} · ${formatDeskStamp(candle.at)}`}
            </title>
            <line x1={x} x2={x} y1={yHigh} y2={yLow} />
            <rect x={x - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} />
          </g>
        );
      })}
      {first ? (
        <text className="near-candle-axis" x={left} y={height - 8}>
          {formatDeskStamp(first.at)}
        </text>
      ) : null}
      <text className="near-candle-axis" x={width - right} y={height - 8} textAnchor="end">
        {last ? `${formatDeskStamp(last.at)} · ${formatUsd(last.close)} held` : `goal ${formatUsd(NEAR_HOLDINGS_GOAL_USD)}`}
      </text>
    </svg>
  );
}
