/**
 * EntityTrack wordmark mark — a flat 2D platformer-style survivor sprinting
 * right, the Entity's claw raking in from behind.
 */
export default function Logo({ size = 22 }) {
  return (
    <svg width={size * 1.5} height={size} viewBox="0 0 48 32" fill="none" aria-hidden="true">
      {/* the Entity's claw, reaching from behind */}
      <g stroke="var(--blood-bright)" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M4 5 C 9 10, 11 17, 10 25" />
        <path d="M2 13 C 7 16, 9 22, 8 29" />
        <path d="M4 22 C 7 24, 9 27, 9 31" />
      </g>
      {/* running survivor — head, leaning torso, striding legs, swinging arms */}
      <g fill="var(--text-bright)">
        <circle cx="30" cy="6" r="3.6" />
        {/* torso, leaning forward */}
        <path d="M28 10 L 34 12 L 30.5 22 L 25 20 Z" />
        {/* front leg driving forward, back leg extended */}
        <path d="M28 19 L 37 24 L 35 27.5 L 25.5 23 Z" />
        <path d="M26 20 L 21 28 L 17.5 26 L 23 18 Z" />
        {/* lead arm forward, trailing arm back */}
        <path d="M32 12 L 40 10 L 41 13.5 L 33 16 Z" />
        <path d="M27 13 L 19 15 L 18 11.5 L 26 10 Z" />
      </g>
    </svg>
  );
}
