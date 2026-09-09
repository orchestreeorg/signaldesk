"use client";

import { useEffect, useRef, useState } from "react";
import { THEMES } from "./theme";
import { useTheme } from "./theme-provider";

export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = THEMES.find((option) => option.id === theme) ?? THEMES[0];

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="theme-menu" ref={root}>
      <button
        type="button"
        className="theme-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Theme"
        onClick={() => setOpen((value) => !value)}
      >
        {current.name}
        <svg className="theme-menu-caret" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 L6 8 L9.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div className="theme-menu-list" role="menu">
          {THEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitem"
              className={theme === option.id ? "theme-menu-item on" : "theme-menu-item"}
              onClick={() => {
                setTheme(option.id);
                setOpen(false);
              }}
            >
              <strong>{option.name}</strong>
              <span>{option.note}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
