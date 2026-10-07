'use client'
import { forwardRef } from 'react'
import { PLAN_ASPECT, TABLE_W, TABLE_RATIO } from '@/lib/floorplan'

// Surface du plan de salle, commune au constructeur et au manager.
// - proportion fixe (identique partout) ;
// - `container-type: inline-size` : les textes des tables se calent sur la largeur du plan
//   (unité cqw), donc rien n'est coupé sur petit écran ;
// - `touch-action: pan-y` : au doigt, on peut toujours faire défiler la page en passant
//   sur le plan ; seules les tables captent le glissement.
export const PlanCanvas = forwardRef<HTMLDivElement, {
  children?: React.ReactNode; radius?: number
}>(function PlanCanvas({ children, radius = 18 }, ref) {
  return (
    <div
      ref={ref}
      style={{
        position: 'relative', width: '100%', aspectRatio: `${1} / ${PLAN_ASPECT}`,
        containerType: 'inline-size',
        background: `
          repeating-linear-gradient(0deg, transparent, transparent 11px, #f1eafc 12px),
          repeating-linear-gradient(90deg, transparent, transparent 11px, #f1eafc 12px),
          #fff`,
        borderRadius: radius, border: '2px dashed var(--surface-border)',
        overflow: 'hidden', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none'
      }}
    >
      {children}
    </div>
  )
})

// Emplacement d'une table : centré sur (x %, y %), taille proportionnelle au plan.
export function PlanTable({ x, y, children, dragging = false, ...handlers }: {
  x: number; y: number; children: React.ReactNode; dragging?: boolean
} & Pick<React.HTMLAttributes<HTMLDivElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'>) {
  return (
    <div
      {...handlers}
      style={{
        position: 'absolute', left: `${x}%`, top: `${y}%`,
        width: `${TABLE_W}%`, aspectRatio: `${1} / ${TABLE_RATIO}`,
        transform: 'translate(-50%, -50%)', cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'none', zIndex: dragging ? 5 : 1,
        transition: dragging ? 'none' : 'left .2s ease, top .2s ease'
      }}
    >
      {children}
    </div>
  )
}

// Tailles de texte qui suivent la largeur du plan (lisibles de 320 px à 1200 px)
export const planFont = {
  name: 'clamp(9.5px, 3.5cqw, 14px)',
  sub: 'clamp(8px, 2.5cqw, 11px)',
  badge: 'clamp(8.5px, 2.6cqw, 11px)'
}
