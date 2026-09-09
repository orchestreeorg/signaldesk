export function BrandLogo() {
  return (
    <>
      <svg className="brand-logo" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#151c25" />
        <path
          d="M6.5 19h3.2l3.1-8.2 2.8 12.4L20 8.5l3.4 10.5H26"
          fill="none"
          stroke="#8ec0ff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M20 8.5 23.4 19" fill="none" stroke="#3dcf8e" strokeWidth="2.1" strokeLinecap="round" />
      </svg>
      <span className="brand-name">Signaldesk</span>
    </>
  );
}
