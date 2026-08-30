// Empêche deux tables de se superposer visuellement sur le plan de salle.
// Le plan n'est pas carré (16:9 ou 16:10) : un même écart en % ne représente pas la même
// distance réelle en largeur qu'en hauteur. `aspect` = hauteur / largeur du plan, pour
// convertir les écarts en une distance comparable dans les deux axes.
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function realDist(dx: number, dy: number, aspect: number) {
  // Ramène l'écart vertical (exprimé en % de hauteur) à une échelle comparable
  // à l'écart horizontal (exprimé en % de largeur).
  return Math.hypot(dx, dy * aspect)
}

export function resolveOverlap(
  others: { x: number; y: number }[],
  startX: number,
  startY: number,
  minDist = 15,
  aspect = 0.625 // hauteur/largeur par défaut (plan 16:10)
): { x: number; y: number } {
  let cx = clamp(startX, 8, 92)
  let cy = clamp(startY, 8, 92)

  const collides = (x: number, y: number) =>
    others.some(o => realDist(o.x - x, o.y - y, aspect) < minDist)

  if (!collides(cx, cy)) return { x: cx, y: cy }

  for (let attempt = 1; attempt <= 48; attempt++) {
    const angle = (attempt * 137.5 * Math.PI) / 180 // angle d'or : répartition homogène
    const radius = minDist * 0.6 * Math.sqrt(attempt)
    // On projette le rayon dans chaque axe en respectant le ratio du plan, pour que
    // le déplacement réel soit homogène (pas plus grand verticalement qu'horizontalement).
    const x = clamp(startX + Math.cos(angle) * radius, 8, 92)
    const y = clamp(startY + Math.sin(angle) * (radius / aspect), 8, 92)
    if (!collides(x, y)) return { x, y }
  }

  return { x: cx, y: cy }
}
