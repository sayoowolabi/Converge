/**
 * A QR-code-like placeholder drawn from the ticket's random token (FR 50).
 * Not a scannable code: the real system renders a QR from the qr_token.
 */
export function QrPlaceholder({ token, label, size = 132 }: { token: string; label: string; size?: number }) {
  const n = 21;
  const bits: boolean[] = [];
  // Expand the hex token into a deterministic bit stream.
  let seed = 0;
  for (const ch of token) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  for (let i = 0; i < n * n; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    bits.push(((seed >>> 16) & 1) === 1);
  }
  const inFinder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
  const finder = (ox: number, oy: number) => (
    <g key={`${ox}-${oy}`}>
      <rect x={ox} y={oy} width={7} height={7} fill="#18382e" />
      <rect x={ox + 1} y={oy + 1} width={5} height={5} fill="#fff" />
      <rect x={ox + 2} y={oy + 2} width={3} height={3} fill="#18382e" />
    </g>
  );
  const cells = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!inFinder(x, y) && bits[y * n + x]) cells.push(<rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} />);
    }
  }
  return (
    <svg
      className="qr"
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`-2 -2 ${n + 4} ${n + 4}`}
      shapeRendering="crispEdges"
    >
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
      <g fill="#18382e">{cells}</g>
      {finder(0, 0)}
      {finder(n - 7, 0)}
      {finder(0, n - 7)}
    </svg>
  );
}
