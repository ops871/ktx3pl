/* ============================================================
   Lid Ripper artwork: the logo and the helmet illustration.
   Pure SVG strings, no images, so they stay crisp at any size.
   ============================================================ */
(function () {
  const GOLD = '#d4af37';
  const INK = '#0f1115';

  /**
   * The Lid Ripper badge: "LR" in a gold ring, torn through by three
   * claw rips. Drawn in a 100×100 box. `bg` is the badge fill (the rips
   * are cut in that color so they read as tears through the letters).
   */
  let logoN = 0;
  function logoMark({ bg = INK, ring = GOLD, letters = '#f4f4f2' } = {}) {
    const clip = 'lrc' + logoN++ + Math.random().toString(36).slice(2, 6);
    return `
      <defs><clipPath id="${clip}"><circle cx="50" cy="50" r="38"/></clipPath></defs>
      <circle cx="50" cy="50" r="45" fill="${bg}" stroke="${ring}" stroke-width="6"/>
      <circle cx="50" cy="50" r="37" fill="none" stroke="${ring}" stroke-width="1.5" opacity=".6"/>
      <g fill="${letters}" fill-rule="evenodd">
        <path d="M22 27 H35 V61 H50 V73 H22 Z"/>
        <path d="M53 27 H68 C78 27 84 33 84 42 C84 48.5 80.5 53 75 55 L86 73 H72.5 L63 57 H65 V73 H53 Z M65 37 V47 H68 C71 47 72.5 45 72.5 42 C72.5 39 71 37 68 37 Z"/>
      </g>
      <g clip-path="url(#${clip})">
        <g stroke="${bg}" stroke-width="3.6" stroke-linecap="round" fill="none">
          <path d="M14 50 L36 14"/>
          <path d="M21 56 L44 18"/>
          <path d="M28 62 L50 26"/>
        </g>
        <g stroke="${ring}" stroke-width="1.3" stroke-linecap="round" fill="none">
          <path d="M16.5 49 L38.5 15"/>
          <path d="M23.5 55 L46.5 19"/>
          <path d="M30.5 61 L52.5 27"/>
        </g>
      </g>`;
  }

  const logoSVG = (opts = {}, label = 'Lid Ripper') =>
    `<svg viewBox="0 0 100 100" role="img" aria-label="${label}">${logoMark(opts)}</svg>`;

  // Shared helmet shell outline (side view, facing right).
  const SHELL = 'M28 108 C14 52 58 14 112 14 C162 14 192 50 190 92 L188 104 C187 112 180 116 172 116 L152 116 L144 140 L64 140 C46 140 33 130 28 108 Z';

  /** Red-white-blue hand-painted USA design, clipped to the shell. */
  function usaPaint(clipId) {
    // Stars for the blue field on the front of the shell.
    const star = (x, y, r) => {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.42 : r;
        pts.push((x + rr * Math.cos(a)).toFixed(1) + ',' + (y + rr * Math.sin(a)).toFixed(1));
      }
      return `<polygon points="${pts.join(' ')}" fill="#f4f4f2"/>`;
    };
    const stars = [
      [146, 34, 4.2], [162, 42, 4.2], [174, 54, 4.2], [140, 50, 4.2], [156, 58, 4.2],
      [170, 70, 4.2], [182, 82, 3.8], [150, 74, 4.2], [164, 88, 4.2], [178, 100, 3.6],
    ].map(([x, y, r]) => star(x, y, r)).join('');
    // Waving stripes sweep from the back of the shell toward the logo.
    const stripes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      .map((i) => {
        const y = 6 + i * 12;
        return `<path d="M0 ${y} C40 ${y - 10} 70 ${y + 14} 132 ${y - 2} L132 ${y + 12} C70 ${y + 28} 40 ${y + 2} 0 ${y + 12} Z" fill="${i % 2 ? '#f4f4f2' : '#c1272d'}"/>`;
      })
      .join('');
    return `
      <g clip-path="url(#${clipId})">
        <rect x="0" y="0" width="220" height="170" fill="#c1272d"/>
        ${stripes}
        <path d="M124 0 C134 40 128 80 138 130 L220 130 L220 0 Z" fill="#1a2456"/>
        <path d="M124 0 C134 40 128 80 138 130" fill="none" stroke="#d4af37" stroke-width="2.5"/>
        ${stars}
      </g>`;
  }

  /**
   * Helmet illustration with the Lid Ripper logo decal on the side.
   * theme: 'solid' (shell color + center stripe) or 'usa' (custom paint).
   */
  function helmetSVG({ shell = '#1a2456', mask = '#8a8f96', stripe = '#f4f4f2', theme = 'solid', signed = true, label = '' } = {}) {
    const id = Math.random().toString(36).slice(2, 8);
    const dark = theme === 'solid' && ['#1b1b1d', '#1a2456', '#b3261e'].includes(shell);
    const sigColor = dark ? '#f1f2f4' : '#111';
    const paint = theme === 'usa'
      ? usaPaint('c' + id)
      : `<path d="${SHELL}" fill="${shell}"/>
         <path d="M52 34 C86 10 146 10 178 44" fill="none" stroke="${stripe}" stroke-width="7" stroke-linecap="round" opacity=".9"/>`;
    return `
<svg viewBox="0 0 220 170" role="img" aria-label="${label || 'Lid Ripper signed football helmet'}">
  <defs>
    <clipPath id="c${id}"><path d="${SHELL}"/></clipPath>
    <radialGradient id="g${id}" cx="40%" cy="28%" r="75%">
      <stop offset="0" stop-color="#fff" stop-opacity=".45"/>
      <stop offset=".45" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${paint}
  <path d="${SHELL}" fill="url(#g${id})"/>
  <path d="${SHELL}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>
  <circle cx="58" cy="100" r="8" fill="rgba(0,0,0,.4)"/>
  <path d="M64 140 L144 140 L140 150 L70 150 Z" fill="rgba(0,0,0,.4)"/>
  <g transform="translate(76 40) scale(.56)">${logoMark({ ring: GOLD })}</g>
  <g fill="none" stroke="${mask}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M156 74 L206 82 L206 132 L150 138"/>
    <path d="M154 104 L206 106"/>
    <path d="M178 78 L178 136"/>
  </g>
  ${signed ? `<path d="M36 84 c5 -12 12 -10 10 0 s-5 10 3 3 s8 -12 12 -5 s2 8 8 2 s6 -6 9 -1" fill="none" stroke="${sigColor}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".92"/>` : ''}
</svg>`;
  }

  window.LR_ART = { logoMark, logoSVG, helmetSVG };
})();
