/**
 * The mark of Fumapress: the reel of a press, inked by hand over an indigo wash, with a pale green dot and the flat
 * offset shadow of the landing's drawings. Colors are the `logo-*` theme colors of app.css, so it reads on every page and theme.
 */
export function Logo({ className }: { className?: string }) {
  const teeth = Array.from({ length: 6 }, (_, i) => (i * Math.PI) / 3 + 0.3);
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        {/* the wobble of a hand-drawn line, and the soft edge of a wash */}
        <filter id="stroke-logo-ink" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.12" numOctaves="2" seed="3" />
          <feDisplacementMap
            in="SourceGraphic"
            scale="0.9"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter id="fp-logo-wash" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="8" />
          <feDisplacementMap
            in="SourceGraphic"
            scale="1.6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>

      {/* the flat shadow on the paper */}
      <circle cx={22.6} cy={22.2} r={15.4} className="fill-logo-shadow" />

      <g filter="url(#fp-logo-wash)">
        <circle cx={19} cy={19} r={15.4} className="fill-logo-paper" />
        <circle cx={19} cy={19} r={15.4} className="fill-logo-indigo" opacity={0.78} />
        {/* the wound tape, darker toward the far side */}
        <circle cx={19} cy={19} r={11} className="fill-logo-deep" opacity={0.38} />
        <path
          d="M27 9.5A12.6 12.6 0 0 1 29.4 27.4A14 14 0 0 0 27 9.5Z"
          className="fill-logo-deep"
          opacity={0.45}
        />
        {/* light on the near rim */}
        <path
          d="M7.4 15A12.4 12.4 0 0 1 17 6.2A10.4 10.4 0 0 0 9.6 17.8Z"
          className="fill-white"
          opacity={0.42}
        />
        <circle cx={19} cy={19} r={5.6} className="fill-logo-cream" />
      </g>

      <g filter="url(#stroke-logo-ink)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* the rim in two passes of the pen, the second a little off */}
        <circle cx={19} cy={19} r={15.4} className="stroke-logo-ink" strokeWidth={1.7} />
        <circle
          cx={19.4}
          cy={18.6}
          r={15.2}
          className="stroke-logo-ink"
          strokeWidth={0.6}
          opacity={0.5}
        />
        <circle
          cx={19}
          cy={19}
          r={11}
          className="stroke-logo-ink"
          strokeWidth={0.7}
          opacity={0.55}
        />
        {/* the wound tape, in fine rings */}
        {[7.4, 8.4, 9.3, 10.2].map((r, i) => (
          <circle
            key={r}
            cx={19}
            cy={19}
            r={r}
            className="stroke-logo-ink"
            strokeWidth={0.35}
            opacity={0.32 - i * 0.05}
          />
        ))}
        {/* the hub, its teeth pointing in, and the bore */}
        <circle cx={19} cy={19} r={5.6} className="stroke-logo-ink" strokeWidth={1.3} />
        {teeth.map((a) => (
          <path
            key={a}
            d={`M${(19 + Math.cos(a) * 5.4).toFixed(2)} ${(19 + Math.sin(a) * 5.4).toFixed(2)}L${(19 + Math.cos(a) * 3.9).toFixed(2)} ${(19 + Math.sin(a) * 3.9).toFixed(2)}`}
            className="stroke-logo-ink"
            strokeWidth={1.4}
          />
        ))}
        <circle cx={19} cy={19} r={1.9} className="stroke-logo-ink" strokeWidth={1} />
        <path d="M9.2 13.2Q12 8.2 17.4 7" className="stroke-white opacity-70" strokeWidth={1} />
      </g>

      {/* the pale green pop */}
      <circle cx={29.2} cy={10.4} r={2.5} className="fill-logo-green" />
      <circle
        cx={29.2}
        cy={10.4}
        r={2.5}
        fill="none"
        className="stroke-logo-ink"
        strokeWidth={0.8}
      />
    </svg>
  );
}
