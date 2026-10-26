// Cartoon food illustrations drawn as SVG, so there are no image files to download or host.
// Each one takes an optional className. Pass decorative to hide it from screen readers.

export function Burger({ className = "", decorative = false }) {
  return (
    <svg className={className} viewBox="0 0 260 220" xmlns="http://www.w3.org/2000/svg" {...(decorative ? { "aria-hidden": "true" } : { role: "img", "aria-label": "A cartoon burger" })}>
      <g stroke="#14231a" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
      <ellipse cx="130" cy="207" rx="95" ry="8" fill="#14231a" fillOpacity=".14" stroke="none"/>
      <path d="M40 166 H220 V176 Q220 196 200 196 H60 Q40 196 40 176 Z" fill="#f2a53a"/>
      <rect x="32" y="140" width="196" height="30" rx="15" fill="#7a3b17"/>
      <path d="M42 138 H218 L212 148 L198 148 L188 170 L176 148 H62 L50 148 Z" fill="#ffcc33"/>
      <rect x="44" y="118" width="172" height="24" rx="12" fill="#e5483b"/>
      <path d="M34 110 Q48 94 62 110 T90 110 T118 110 T146 110 T174 110 T202 110 T226 110 V118 Q200 124 130 120 Q60 124 34 118 Z" fill="#66bb4a"/>
      <path d="M38 104 Q38 28 130 28 Q222 28 222 104 Q222 112 212 112 H48 Q38 112 38 104 Z" fill="#f5b041"/>
      <path d="M62 82 Q70 56 102 46" fill="none" stroke="#ffffff" strokeOpacity=".65" strokeWidth="7"/>
      </g>
      <g fill="#fff3d6" stroke="#14231a" strokeWidth="2.5">
      <ellipse cx="100" cy="66" rx="7" ry="4" transform="rotate(-25 100 66)"/>
      <ellipse cx="132" cy="50" rx="7" ry="4" transform="rotate(10 132 50)"/>
      <ellipse cx="164" cy="64" rx="7" ry="4" transform="rotate(30 164 64)"/>
      <ellipse cx="118" cy="88" rx="7" ry="4" transform="rotate(-10 118 88)"/>
      <ellipse cx="152" cy="90" rx="7" ry="4" transform="rotate(20 152 90)"/>
      <ellipse cx="190" cy="86" rx="7" ry="4" transform="rotate(-30 190 86)"/>
      <ellipse cx="78" cy="94" rx="7" ry="4" transform="rotate(15 78 94)"/>
      </g>
    </svg>
  );
}

export function Plate({ className = "", decorative = false }) {
  return (
    <svg className={className} viewBox="0 0 240 220" xmlns="http://www.w3.org/2000/svg" {...(decorative ? { "aria-hidden": "true" } : { role: "img", "aria-label": "A cartoon plate of rice and chicken" })}>
      <g stroke="#14231a" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
      <ellipse cx="120" cy="196" rx="86" ry="9" fill="#14231a" fillOpacity=".14" stroke="none"/>
      <path d="M92 40 Q80 28 92 18 Q104 8 94 -2" transform="translate(0 6)" fill="none" stroke="#14231a" strokeOpacity=".35" strokeWidth="5"/>
      <path d="M126 38 Q114 26 126 16 Q138 6 128 -4" transform="translate(0 6)" fill="none" stroke="#14231a" strokeOpacity=".35" strokeWidth="5"/>
      <path d="M160 42 Q148 30 160 20 Q172 10 162 0" transform="translate(0 6)" fill="none" stroke="#14231a" strokeOpacity=".35" strokeWidth="5"/>
      <ellipse cx="120" cy="146" rx="100" ry="40" fill="#ffffff"/>
      <ellipse cx="120" cy="142" rx="74" ry="28" fill="#e9eee4"/>
      <path d="M60 142 Q62 78 118 74 Q176 78 178 142 Q150 164 120 164 Q90 164 60 142 Z" fill="#f0662b"/>
      <path d="M150 150 Q146 118 174 116 Q202 116 200 142 Q198 164 170 166 Q152 166 150 150 Z" fill="#b5651d"/>
      <path d="M196 150 L222 170" strokeWidth="9" fill="none"/>
      <path d="M196 150 L222 170" stroke="#fff3d6" strokeWidth="3.5" fill="none"/>
      <circle cx="224" cy="166" r="8" fill="#fff3d6"/>
      <circle cx="216" cy="176" r="8" fill="#fff3d6"/>
      <path d="M162 132 Q170 124 182 126" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="5"/>
      <ellipse cx="70" cy="150" rx="22" ry="12" fill="#ffd45e"/>
      <ellipse cx="96" cy="162" rx="20" ry="10" fill="#f5b041"/>
      </g>
      <g fill="#ffd9a8" stroke="none">
      <circle cx="98" cy="104" r="3.5"/><circle cx="120" cy="96" r="3.5"/><circle cx="142" cy="106" r="3.5"/>
      <circle cx="110" cy="122" r="3.5"/><circle cx="134" cy="126" r="3.5"/><circle cx="88" cy="128" r="3.5"/><circle cx="154" cy="130" r="3.5"/>
      </g>
      <path d="M92 92 Q100 82 116 80" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="6" strokeLinecap="round"/>
    </svg>
  );
}

export function Scooter({ className = "", decorative = false }) {
  return (
    <svg className={className} viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg" {...(decorative ? { "aria-hidden": "true" } : { role: "img", "aria-label": "A cartoon delivery scooter" })}>
      <g stroke="#14231a" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
      <ellipse cx="150" cy="205" rx="130" ry="8" fill="#14231a" fillOpacity=".14" stroke="none"/>
      <path d="M4 120 H34 M0 142 H26 M10 164 H34" stroke="#14231a" strokeOpacity=".3" strokeWidth="5" fill="none"/>
      <rect x="34" y="66" width="68" height="56" rx="9" fill="#14532d"/>
      <path d="M34 84 H102" fill="none"/>
      <text x="68" y="112" textAnchor="middle" fontFamily="Bricolage Grotesque, Arial Black, sans-serif" fontSize="25" fontWeight="800" fill="#f2a900" stroke="none">FÜD</text>
      <path d="M62 150 Q72 118 112 116 H176 L190 152 H62 Z" fill="#f2a900"/>
      <rect x="104" y="152" width="92" height="12" rx="6" fill="#d98f00"/>
      <path d="M188 152 L206 80 L224 85 L210 152 Z" fill="#f2a900"/>
      <rect x="100" y="100" width="56" height="16" rx="8" fill="#3d2b1f"/>
      <path d="M196 76 L238 68" strokeWidth="9" fill="none"/>
      <circle cx="237" cy="94" r="9" fill="#fff3a8"/>
      <path d="M214 100 L236 172" fill="none" strokeWidth="9"/>
      <circle cx="76" cy="172" r="30" fill="#2b3a31"/><circle cx="76" cy="172" r="13" fill="#d7dfda"/><circle cx="76" cy="172" r="4" fill="#14231a"/>
      <circle cx="236" cy="172" r="30" fill="#2b3a31"/><circle cx="236" cy="172" r="13" fill="#d7dfda"/><circle cx="236" cy="172" r="4" fill="#14231a"/>
      <path d="M126 108 L142 112 L176 130" stroke="#2f6fb5" strokeWidth="16" fill="none"/>
      <path d="M176 130 L184 156" stroke="#2f6fb5" strokeWidth="14" fill="none"/>
      <ellipse cx="186" cy="160" rx="13" ry="7" fill="#14231a"/>
      <path d="M118 108 Q112 76 126 66 L152 68 Q160 84 150 110 Z" fill="#e5483b"/>
      <path d="M146 78 L204 74" stroke="#e5483b" strokeWidth="13" fill="none"/>
      <circle cx="208" cy="73" r="8" fill="#f1c27d"/>
      <circle cx="140" cy="50" r="17" fill="#f1c27d"/>
      <path d="M122 50 A18 18 0 0 1 158 50 Z" fill="#14532d"/>
      <path d="M150 46 H162 V54 H150 Z" fill="#cfe8ff" strokeWidth="3"/>
      </g>
    </svg>
  );
}

export function Groceries({ className = "", decorative = false }) {
  return (
    <svg className={className} viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" {...(decorative ? { "aria-hidden": "true" } : { role: "img", "aria-label": "A cartoon hand holding a bag of groceries" })}>
      <g stroke="#14231a" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
      <ellipse cx="120" cy="228" rx="78" ry="8" fill="#14231a" fillOpacity=".14" stroke="none"/>
      <path d="M92 126 Q98 80 114 58" fill="none" strokeWidth="6"/>
      <path d="M148 126 Q142 80 126 58" fill="none" strokeWidth="6"/>
      <path d="M150 126 L178 74 Q184 66 193 72 Q200 78 196 87 L172 132 Z" fill="#f5b041"/>
      <path d="M172 108 L192 80 M164 120 L184 94" stroke="#c86a2a" strokeWidth="3" fill="none"/>
      <path d="M104 126 Q90 88 108 74 Q122 90 124 126 Z" fill="#66bb4a"/>
      <path d="M126 126 Q124 98 146 92 Q152 110 142 126 Z" fill="#4ea63a"/>
      <path d="M58 126 L68 80 L92 80 L94 126 Z" fill="#e8f1ff"/>
      <rect x="64" y="70" width="24" height="12" rx="3" fill="#e5483b"/>
      <path d="M44 124 L58 112 L68 138 L54 148 Z" fill="#f0662b"/>
      <path d="M54 126 L48 114" stroke="#2f9e44" strokeWidth="5" fill="none"/>
      <path d="M62 122 H178 L168 214 Q167 226 157 226 H83 Q73 226 72 214 Z" fill="#e0aa6b"/>
      <path d="M62 122 H178 L176 138 H64 Z" fill="#cf9456"/>
      <path d="M92 160 Q120 150 148 160" fill="none" stroke="#14231a" strokeOpacity=".35" strokeWidth="4"/>
      <circle cx="120" cy="186" r="21" fill="#f2a900"/>
      <text x="120" y="195" textAnchor="middle" fontFamily="Bricolage Grotesque, Arial Black, sans-serif" fontSize="24" fontWeight="800" fill="#14532d" stroke="none">F</text>
      <rect x="98" y="-6" width="44" height="32" rx="4" fill="#14532d"/>
      <path d="M94 22 H146 V30 H94 Z" fill="#0f3d21"/>
      <rect x="94" y="30" width="52" height="34" rx="15" fill="#f1c27d"/>
      <path d="M107 44 V62 M120 44 V64 M133 44 V62" strokeWidth="3.5" fill="none"/>
      <ellipse cx="92" cy="46" rx="8" ry="13" fill="#f1c27d" transform="rotate(-20 92 46)"/>
      </g>
    </svg>
  );
}

export function Fries({ className = "", decorative = false }) {
  return (
    <svg className={className} viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" {...(decorative ? { "aria-hidden": "true" } : { role: "img", "aria-label": "Fries" })}>
      <g stroke="#14231a" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
      <rect x="26" y="14" width="14" height="60" rx="4" fill="#ffd45e" transform="rotate(-12 33 44)"/>
      <rect x="44" y="6" width="14" height="66" rx="4" fill="#ffc933"/>
      <rect x="62" y="12" width="14" height="62" rx="4" fill="#ffd45e" transform="rotate(8 69 43)"/>
      <rect x="80" y="20" width="14" height="54" rx="4" fill="#ffc933" transform="rotate(16 87 47)"/>
      <path d="M18 66 H102 L94 128 Q93 134 87 134 H33 Q27 134 26 128 Z" fill="#e5483b"/>
      <path d="M30 88 H90" stroke="#fff3d6" strokeWidth="6" fill="none"/></g>
    </svg>
  );
}

export function Pizza({ className = "", decorative = false }) {
  return (
    <svg className={className} viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg" {...(decorative ? { "aria-hidden": "true" } : { role: "img", "aria-label": "Pizza" })}>
      <g stroke="#14231a" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M70 128 L16 34 Q70 6 124 34 Z" fill="#ffcc33"/>
      <path d="M16 34 Q70 6 124 34" fill="none" strokeWidth="12" stroke="#f2a53a"/>
      <path d="M16 34 Q70 6 124 34" fill="none" strokeWidth="5"/>
      <circle cx="56" cy="50" r="9" fill="#e5483b"/><circle cx="88" cy="56" r="9" fill="#e5483b"/><circle cx="70" cy="84" r="9" fill="#e5483b"/>
      <circle cx="72" cy="40" r="3" fill="#66bb4a" stroke="none"/><circle cx="52" cy="72" r="3" fill="#66bb4a" stroke="none"/></g>
    </svg>
  );
}

export function Donut({ className = "", decorative = false }) {
  return (
    <svg className={className} viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg" {...(decorative ? { "aria-hidden": "true" } : { role: "img", "aria-label": "Donut" })}>
      <g stroke="#14231a" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
      <circle cx="70" cy="70" r="54" fill="#f5b041"/>
      <path d="M22 66 Q26 24 70 22 Q114 24 118 66 Q112 52 100 60 Q92 46 80 58 Q70 44 60 58 Q48 46 40 60 Q28 52 22 66 Z" fill="#f48fb1"/>
      <circle cx="70" cy="70" r="16" fill="#fff6e5"/>
      <path d="M44 40 l8 -4 M88 34 l6 6 M100 54 l8 2 M34 56 l-2 8" stroke="#fff" strokeWidth="4" fill="none"/></g>
    </svg>
  );
}

export function Cup({ className = "", decorative = false }) {
  return (
    <svg className={className} viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" {...(decorative ? { "aria-hidden": "true" } : { role: "img", "aria-label": "A cold drink" })}>
      <g stroke="#14231a" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M70 4 L62 40" fill="none" stroke="#e5483b" strokeWidth="7"/>
      <rect x="18" y="38" width="84" height="14" rx="7" fill="#ffffff"/>
      <path d="M24 52 H96 L88 138 Q87 144 81 144 H39 Q33 144 32 138 Z" fill="#e5483b"/>
      <path d="M28 84 H92" stroke="#fff3d6" strokeWidth="16" fill="none"/>
      <circle cx="60" cy="84" r="7" fill="#e5483b" stroke="none"/></g>
    </svg>
  );
}