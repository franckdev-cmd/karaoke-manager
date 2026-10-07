// Géométrie du plan de salle.
//
// Principe : le plan a UNE proportion fixe (PLAN_ASPECT) sur tous les écrans, et chaque
// table occupe une part fixe de la largeur du plan (TABLE_W, en %). Les tables grandissent
// ou rétrécissent donc avec le plan : la disposition est strictement identique sur
// téléphone, tablette et ordinateur, et les calculs de collision / de bord se font en %
// sans jamais dépendre d'une taille en pixels.

export const PLAN_ASPECT = 3 / 4      // hauteur / largeur du plan (affichage 4:3)
export const TABLE_W = 22             // largeur d'une table, en % de la largeur du plan
export const TABLE_RATIO = 0.56       // hauteur / largeur d'une table
const GAP = 2.5                       // espace minimal entre deux tables (en % de largeur)
const EDGE = 3.5                      // marge minimale entre une table et le bord de la salle

// Demi-dimensions d'une table, exprimées en % de la largeur (x) et de la hauteur (y) du plan
const HALF_W = TABLE_W / 2
const HALF_H = (TABLE_W * TABLE_RATIO) / PLAN_ASPECT / 2
const GAP_Y = GAP / PLAN_ASPECT

type Pt = { x: number; y: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Ramène un centre de table à l'intérieur de la salle, bords compris. */
export function clampToRoom(p: Pt): Pt {
  return {
    x: clamp(p.x, HALF_W + EDGE, 100 - HALF_W - EDGE),
    y: clamp(p.y, HALF_H + EDGE / PLAN_ASPECT, 100 - HALF_H - EDGE / PLAN_ASPECT)
  }
}

/** Vrai si une table centrée en `p` touche (ou frôle) l'une des `others`. */
export function collides(others: Pt[], p: Pt): boolean {
  return others.some(o =>
    Math.abs(o.x - p.x) < TABLE_W + GAP && Math.abs(o.y - p.y) < HALF_H * 2 + GAP_Y
  )
}

/**
 * Cherche l'emplacement libre le plus proche de `target`, bords de la salle respectés.
 * `ok` vaut false uniquement si la salle est pleine (aucun emplacement libre).
 */
export function placeTable(others: Pt[], target: Pt): Pt & { ok: boolean } {
  const start = clampToRoom(target)
  if (!collides(others, start)) return { ...start, ok: true }

  const lo = clampToRoom({ x: 0, y: 0 })
  const hi = clampToRoom({ x: 100, y: 100 })
  let best: Pt | null = null
  let bestD = Infinity
  // Balayage fin de toute la salle (pas de 1 %) : on garde le point libre le plus proche.
  for (let y = lo.y; y <= hi.y + 0.001; y += 1) {
    for (let x = lo.x; x <= hi.x + 0.001; x += 1) {
      const p = { x, y }
      if (collides(others, p)) continue
      const d = Math.hypot(x - start.x, (y - start.y) * PLAN_ASPECT)
      if (d < bestD) { bestD = d; best = p }
    }
  }
  return best ? { ...best, ok: true } : { ...start, ok: false }
}

/**
 * Déplacement pendant le glisser : la table suit le doigt mais ne peut ni sortir de la
 * salle ni toucher une autre table. Si la cible est bloquée, elle glisse le long de
 * l'obstacle (essai axe par axe) au lieu de se figer.
 */
export function moveWithin(others: Pt[], prev: Pt, target: Pt): Pt {
  const t = clampToRoom(target)
  if (!collides(others, t)) return t
  const slideX = { x: t.x, y: prev.y }
  if (!collides(others, slideX)) return slideX
  const slideY = { x: prev.x, y: t.y }
  if (!collides(others, slideY)) return slideY
  return prev
}

/**
 * Remet d'aplomb une salle dont les tables se chevauchent ou dépassent (anciens
 * enregistrements, tailles différentes d'avant). Retourne uniquement les tables déplacées.
 */
export function repairLayout<T extends Pt & { id: string }>(tables: T[]): { id: string; x: number; y: number }[] {
  const placed: Pt[] = []
  const moved: { id: string; x: number; y: number }[] = []
  for (const t of tables) {
    const r = placeTable(placed, { x: t.x, y: t.y })
    placed.push({ x: r.x, y: r.y })
    if (Math.abs(r.x - t.x) > 0.01 || Math.abs(r.y - t.y) > 0.01) moved.push({ id: t.id, x: r.x, y: r.y })
  }
  return moved
}

/** Position de départ d'une nouvelle table : premier emplacement libre, de haut en bas. */
export function firstFreeSpot(others: Pt[]): Pt & { ok: boolean } {
  return placeTable(others, { x: 0, y: 0 })
}
