"use client";

import { useEffect, useId, useState } from "react";
import { simulateNearHoldingsUsd } from "../../../src/jobs/nearSimulate.js";

function formatNear(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function formatUsd(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  return n < 0 ? `−${abs.replace("$", "$")}` : abs;
}

export function NearPriceSimulator(props: { tokens: number; livePrice?: number | null }) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const mark = Number(price);
  const usd = simulateNearHoldingsUsd(props.tokens, mark);

  const openModal = () => {
    setPrice(props.livePrice && props.livePrice > 0 ? String(props.livePrice) : "");
    setOpen(true);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="text-link" onClick={openModal}>
        Simulate
      </button>
      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId}>Simulate</h2>
            <p className="meta">Toy mark on current NEAR holdings. Does not write lots.</p>
            <label>
              NEAR price
              <input
                type="number"
                min="0"
                step="any"
                placeholder="USD"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                autoFocus
              />
            </label>
            <div className="metric">{usd == null ? "—" : formatUsd(usd)}</div>
            <div className="meta">
              {formatNear(props.tokens)} NEAR
              {Number.isFinite(mark) && mark > 0 ? ` × ${formatUsd(mark)}` : ""}
            </div>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
