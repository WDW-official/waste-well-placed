import { useId } from "react";

export function LoadIllustration({ fraction, heavy = false }: { fraction: number; heavy?: boolean }) {
  const id = useId().replace(/:/g, "");
  const count = Math.max(1, Math.round(fraction * 8));
  return <svg viewBox="0 0 350 180" role="img" aria-label={`${heavy ? "Heavy" : "Light"} waste illustration in a collection van`}>
    <defs><linearGradient id={`${id}-box`} x2="0" y2="1"><stop stopColor="#f9fbf9" /><stop offset="1" stopColor="#dce7df" /></linearGradient></defs>
    <ellipse cx="175" cy="159" rx="157" ry="9" fill="#003e3510" />
    <path d="M26 34h210v110H26z" fill={`url(#${id}-box)`} stroke="#a7b9b0" strokeWidth="2" /><path d="M34 42h194v90H34z" fill="#f8faf7" /><path d="M34 42h194v9H34z" fill="#e3e9e0" /><path d="m34 132 9-9h185v9" fill="#cec7b5" />
    <path d="M236 72h49l35 41v31h-84z" fill="#06483b" /><path d="M246 81h34l24 30h-58z" fill="#b9d8d0" /><path d="M250 85h25l17 21h-42z" fill="#dff0e7" /><path d="M238 143h86" stroke="#1c312b" strokeWidth="8" /><rect x="310" y="119" width="9" height="7" rx="2" fill="#fff5ca" /><path d="M274 118h9" stroke="#7caa95" strokeWidth="3" />
    <text x="247" y="134" fontSize="8" fontFamily="Arial" fontWeight="700" fill="white">WELL PLACED</text>
    <path d="M22 141h214" stroke="#153c30" strokeWidth="6" />
    {[68, 279].map(x => <g key={x}><circle cx={x} cy="145" r="18" fill="#1b2b27" /><circle cx={x} cy="145" r="10" fill="#d9e4df" /><circle cx={x} cy="145" r="4" fill="#778d81" /></g>)}
    {Array.from({ length: count }, (_, i) => { const x = 204 - (i % 4) * 41; const y = 91 - Math.floor(i / 4) * 36; return heavy ? <g key={i}><path d={`M${x - 20} ${y + 31}q-5-8 0-17l4-8h13l5 8q6 13-1 17z`} fill="#536962" /><path d={`M${x - 13} ${y + 5}l-2-6h11l-2 6`} fill="#3b5149" /><path d={`M${x - 15} ${y + 19}l12 5`} stroke="#73847d" /></g> : <g key={i}><rect x={x - 24} y={y} width="32" height="32" rx="2" fill={i % 2 ? "#c7b697" : "#d9c9ac"} /><path d={`M${x - 8} ${y}v32M${x - 24} ${y + 6}h32`} stroke="#b2a080" /><path d={`M${x - 12} ${y + 23}h8`} stroke="#7e7966" strokeWidth="2" /></g>; })}
    <rect x="24" y="39" width="4" height="10" rx="1" fill="#f3ae6b" /><rect x="24" y="123" width="4" height="11" rx="1" fill="#d56352" />
  </svg>;
}
