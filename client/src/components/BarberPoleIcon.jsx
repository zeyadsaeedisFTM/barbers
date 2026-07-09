export default function BarberPoleIcon({ className = 'h-10 w-10' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="14" fill="#211d19" />
      <g transform="translate(32,32) rotate(20)">
        <rect x="-6" y="-24" width="12" height="48" rx="6" fill="#f2ead9" />
        <path d="M-6 -24 L6 -24 L6 -12 L-6 0 Z" fill="#a3352c" />
        <path d="M-6 -6 L6 -18 L6 -6 L-6 6 Z" fill="#a3352c" />
        <path d="M-6 6 L6 -6 L6 6 L-6 18 Z" fill="#a3352c" />
        <circle cx="0" cy="-27" r="4" fill="#c9a24b" />
        <circle cx="0" cy="27" r="4" fill="#c9a24b" />
      </g>
    </svg>
  );
}
