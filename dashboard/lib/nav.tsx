import type { ReactNode } from "react";
import { BrandLogo } from "./logo";

export function StatusChip(props: { online: boolean; paused?: boolean; label: string }) {
  const state = props.online ? (props.paused ? "pause" : "on") : "off";
  return (
    <div className={`chip chip-${state}`}>
      <span className={`dot ${props.online ? (props.paused ? "pause" : "on") : ""}`} />
      {props.label}
    </div>
  );
}

export function DeskNav(props: {
  current: "overview" | "console" | "parameters";
  extra?: ReactNode;
}) {
  const link = (href: string, id: typeof props.current, label: string) => (
    <a className={`nav-link ${props.current === id ? "active" : ""}`} href={href}>
      {label}
    </a>
  );
  return (
    <div className="top-actions">
      <nav className="nav">
        {link("/", "overview", "Overview")}
        {link("/console", "console", "Console")}
        {link("/parameters", "parameters", "Parameters")}
      </nav>
      {props.extra}
    </div>
  );
}

export function AppShell(props: {
  current: "overview" | "console" | "parameters";
  title: string;
  subtitle: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app">
      <header className="appbar">
        <a className="brand" href="/" aria-label="Signaldesk">
          <BrandLogo />
        </a>
        <DeskNav current={props.current} extra={props.extra} />
      </header>
      <main className="shell">
        <div className="page-head">
          <h1>{props.title}</h1>
          <p className="sub">{props.subtitle}</p>
        </div>
        {props.children}
      </main>
    </div>
  );
}
