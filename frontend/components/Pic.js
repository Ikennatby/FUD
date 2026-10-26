// A picture, or a coloured circle/square with the first letter when there is no picture yet.
export default function Pic({ src, name = "", size = 56, round = false, className = "" }) {
  const style = { width: size, height: size, borderRadius: round ? "50%" : 12 };
  if (src) return <img className={`pic ${className}`} src={src} alt={name} style={style} />;
  return <span className={`pic pic-empty ${className}`} style={{ ...style, fontSize: size * 0.42 }} aria-hidden="true">{(name.trim()[0] || "?").toUpperCase()}</span>;
}