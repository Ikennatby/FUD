const PATHS = {
  history: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8z M4 21a8 8 0 0116 0",
  lock: "M6 11h12v10H6z M8 11V8a4 4 0 118 0v3",
  bell: "M6 16v-5a6 6 0 1112 0v5l2 2H4z M10 21h4",
  help: "M12 21a9 9 0 100-18 9 9 0 000 18z M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1-1.5 2 M12 17h.01",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13",
  logout: "M10 4H5v16h5 M15 8l4 4-4 4 M19 12H9",
  check: "M5 12l5 5 9-10",
  mail: "M3 6h18v12H3z M3 7l9 6 9-6",
};

export default function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
