const PALETTE = ['#a3352c', '#9c7c34', '#3a5a52', '#5a4a7c'];

function hashName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export default function InitialsAvatar({ name, className = 'h-24 w-24' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  const color = PALETTE[hashName(name) % PALETTE.length];

  return (
    <div
      className={`${className} rounded-full flex items-center justify-center font-heading text-2xl text-cream shrink-0`}
      style={{ backgroundColor: color }}
    >
      {initials || '?'}
    </div>
  );
}
