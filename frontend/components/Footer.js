// Put your links between the quotes. A link left as "" is hidden until you fill it in.
const LINKS = {
  instagram: "",   // e.g. "https://instagram.com/yourpage"
  twitter: "",     // e.g. "https://x.com/yourpage"
  snapchat: "",    // e.g. "https://snapchat.com/add/yourname"
  whatsapp: "https://wa.me/message/D5OE7YM77JDRN1",
};
const PHONE = "09127568838";

export default function Footer() {
  const social = [
    ["Instagram", LINKS.instagram],
    ["Twitter", LINKS.twitter],
    ["Snapchat", LINKS.snapchat],
    ["WhatsApp", LINKS.whatsapp],
  ].filter(([, href]) => href);
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-links">
          <a href={`tel:${PHONE}`}>Call: {PHONE}</a>
          {social.map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
          ))}
        </div>
        <p>© 2027 FUD Logistics LTD. All rights reserved.</p>
      </div>
    </footer>
  );
}