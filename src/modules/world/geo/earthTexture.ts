// Draws the flat world map (equirectangular, longitude -180..180 left to right) onto a canvas that
// becomes the globe's surface. Black ocean, pink coastlines, faint graticule.
import { geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo';
import type { CountryFeature } from './countries';

export function drawEarthTexture(
  canvas: HTMLCanvasElement,
  countries: readonly CountryFeature[],
  highlight?: string | null,
): void {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const projection = geoEquirectangular()
    .scale(w / (2 * Math.PI))
    .translate([w / 2, h / 2]);
  const path = geoPath(projection, ctx);

  ctx.fillStyle = '#05020a';
  ctx.fillRect(0, 0, w, h);

  ctx.beginPath();
  path(geoGraticule10());
  ctx.strokeStyle = 'rgba(255,45,149,0.13)';
  ctx.lineWidth = Math.max(1, w / 2048);
  ctx.stroke();

  ctx.lineJoin = 'round';
  for (const c of countries) {
    const selected = !!highlight && c.properties?.name === highlight;
    ctx.beginPath();
    path(c);
    ctx.fillStyle = selected ? 'rgba(255,45,149,0.55)' : '#1c0b24';
    ctx.fill();
    ctx.strokeStyle = selected ? '#ffffff' : 'rgba(255,45,149,0.85)';
    ctx.lineWidth = (selected ? 2.4 : 1.2) * Math.max(1, w / 2048);
    ctx.stroke();
  }
}
