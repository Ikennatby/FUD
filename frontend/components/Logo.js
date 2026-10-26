export default function Logo() {
  return (
    <span className="logo">
      <svg className="logo-mark" viewBox="0 0 40 40" aria-hidden="true">
        <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1c7a43" /><stop offset="1" stopColor="#0b2f1a" /></linearGradient></defs>
        <rect width="40" height="40" rx="11" fill="url(#lg)" />
        <path d="M8 20h24a12 12 0 0 1-24 0z" fill="#f2a900" />
        <rect x="7" y="18.5" width="26" height="2.4" rx="1.2" fill="#ffd45e" />
        <g className="steam" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <path d="M15 14c-2-2 2-3 0-6" /><path d="M21 14c-2-2 2-3 0-6" /><path d="M27 14c-2-2 2-3 0-6" />
        </g>
      </svg>
      <span className="wordmark">F<span className="u">U</span>D</span>
    </span>
  );
}
