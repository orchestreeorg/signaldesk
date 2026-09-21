"use client";

import { useState } from "react";
import { holdingsCandles, holdingsGoalProgress, holdingsScale, NEAR_CHART_LIMIT, NEAR_HOLDINGS_GOAL_USD, type HoldingsCandle } from "../../../src/jobs/nearChart.js";
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

export function NearHoldingsChart(props: { lots: Lot[]; held: number }) {
  const candles = holdingsCandles(props.lots);
  const progress = holdingsGoalProgress(props.held);
  return (
    <>
      <div className="near-goal-row">
        <strong>
          {formatUsd(progress.held)} / {formatUsd(progress.goal)}
        </strong>
        <span className="near-goal-pct">{progress.pct.toFixed(1)}%</span>
      </div>
      {candles.length === 0 ? <p className="empty-inline">Record entries and exits to chart holdings USD</p> : null}
      <CandlePlot candles={candles} />
    </>
  );
}

function CandlePlot(props: { candles: HoldingsCandle[] }) {
  const width = 960;
  const height = 220;
  const left = 8;
  const right = 88;
  const top = 18;
  const bottom = 16;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const { min, max } = holdingsScale(props.candles);
  const slot = plotW / NEAR_CHART_LIMIT;
  const bodyW = Math.max(3, Math.min(12, slot * 0.7));
  const ticks = [NEAR_HOLDINGS_GOAL_USD, NEAR_HOLDINGS_GOAL_USD / 2, min].filter(
    (tick, i, rows) => rows.indexOf(tick) === i,
  );
  const goalY = yOf(NEAR_HOLDINGS_GOAL_USD, min, max, top, top + plotH);
  const axisX = width - right + 12;
  const [hover, setHover] = useState<{ candle: HoldingsCandle; x: number; y: number } | null>(null);

  return (
    <div className="near-candles-wrap">
      <svg
        className="near-candles"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="NEAR holdings USD candles with 300k goal"
      >
        {ticks.map((tick, i) => {
          const y = yOf(tick, min, max, top, top + plotH);
          const belowLine = tick === NEAR_HOLDINGS_GOAL_USD ? 12 : 3;
          return (
            <g key={`${tick}-${i}`}>
              <line className="near-candle-grid" x1={left} x2={width - right} y1={y} y2={y} />
              <text className="near-candle-axis" x={axisX} y={y + belowLine} textAnchor="start">
                {formatUsd(tick)}
              </text>
            </g>
          );
        })}
        <line className="near-candle-goal" x1={left} x2={width - right} y1={goalY} y2={goalY} />
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
            <g
              key={candle.id}
              className={up ? "near-candle-up" : "near-candle-down"}
              onMouseEnter={() => setHover({ candle, x, y: bodyTop })}
              onMouseLeave={() => setHover(null)}
            >
              <rect className="near-candle-hit" x={left + slot * i} y={top} width={slot} height={plotH} />
              <line x1={x} x2={x} y1={yHigh} y2={yLow} />
              <rect x={x - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} />
            </g>
          );
        })}
      </svg>
      {hover ? (
        <div
          className="near-candle-tip"
          style={{ left: `${(hover.x / width) * 100}%`, top: `${(hover.y / height) * 100}%` }}
        >
          <strong>
            {hover.candle.side} {formatUsd(hover.candle.lotValue)}
          </strong>
          <span>
            held {formatUsd(hover.candle.open)} → {formatUsd(hover.candle.close)}
          </span>
          <span>{formatDeskStamp(hover.candle.at)}</span>
        </div>
      ) : null}
    </div>
  );
}
