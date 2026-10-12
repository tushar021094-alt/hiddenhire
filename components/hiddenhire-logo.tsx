import Link from "next/link";

type HiddenHireLogoProps = {
  compact?: boolean;
  linked?: boolean;
  className?: string;
};

function Mark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`hh-mark ${compact ? "hh-mark-compact" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none" role="presentation">
        <defs>
          <linearGradient id="hh-gradient" x1="5" y1="4" x2="35" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A78BFA" />
            <stop offset="1" stopColor="#35E0D0" />
          </linearGradient>
        </defs>
        <path d="M10 9V31M30 9V31M10 20H30" stroke="url(#hh-gradient)" strokeWidth="4" strokeLinecap="round" />
        <path d="M14.5 14.5L20 9L25.5 14.5M14.5 25.5L20 31L25.5 25.5" stroke="#F2F4F8" strokeOpacity=".92" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="30" cy="10" r="3" fill="#35E0D0" />
      </svg>
    </span>
  );
}

export default function HiddenHireLogo({ compact = false, linked = true, className = "" }: HiddenHireLogoProps) {
  const content = (
    <span className={`hh-brand ${className}`}>
      <Mark compact={compact} />
      {!compact && (
        <span className="hh-wordmark">
          <span className="hh-wordmark-main">HiddenHire</span>
          <span className="hh-wordmark-sub">CAREER INTELLIGENCE</span>
        </span>
      )}
    </span>
  );

  return linked ? <Link href="/" aria-label="HiddenHire home" className="hh-brand-link">{content}</Link> : content;
}
