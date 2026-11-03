import { useState } from 'react'
import type { FloorPlan, Room } from '../data/site'

const FILLS: Record<string, string> = {
  living: 'hsl(var(--brass) / 0.14)',
  wet: 'hsl(var(--ink) / 0.07)',
  terrace: 'hsl(var(--brass) / 0.06)',
}

function roomFill(room: Room) {
  return room.tone ? FILLS[room.tone] : 'hsl(var(--card))'
}

function PlanCanvas({ plan }: { plan: FloorPlan }) {
  return (
    <svg
      viewBox={`0 0 ${plan.width} ${plan.height}`}
      role="img"
      aria-label={`${plan.name} floor plan, ${plan.bedrooms}, ${plan.size}`}
      className="h-auto w-full border border-border bg-background"
    >
      <rect
        x="0"
        y="0"
        width={plan.width}
        height={plan.height}
        fill="hsl(var(--card))"
        stroke="hsl(var(--ink) / 0.45)"
        strokeWidth="0.5"
      />
      {plan.rooms.map((room) => (
        <g key={`${room.label}-${room.x}-${room.y}`}>
          <rect
            x={room.x}
            y={room.y}
            width={room.w}
            height={room.h}
            fill={roomFill(room)}
            stroke="hsl(var(--ink) / 0.35)"
            strokeWidth="0.4"
          />
          <text
            x={room.x + room.w / 2}
            y={room.y + room.h / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={room.w < 22 ? 1.9 : 2.2}
            letterSpacing="0.08"
            fill="hsl(var(--ink) / 0.85)"
            style={{ textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }}
          >
            {room.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function FloorPlanSection({ plans }: { plans: FloorPlan[] }) {
  const [activeId, setActiveId] = useState(plans[0]?.id ?? '')
  const active = plans.find((plan) => plan.id === activeId) ?? plans[0]
  if (!active) return null

  return (
    <div data-testid="floor-plans" data-state="ready">
      <div className="flex flex-wrap gap-2">
        {plans.map((plan) => {
          const isActive = plan.id === active.id
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setActiveId(plan.id)}
              data-testid={`plan-tab-${plan.id}`}
              aria-pressed={isActive}
              className={[
                'eyebrow px-5 py-3 text-[0.55rem] transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-ink-soft hover:border-brass',
              ].join(' ')}
            >
              {plan.name}
            </button>
          )
        })}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-8" data-testid="plan-canvas">
          <PlanCanvas plan={active} />
        </div>

        <div className="lg:col-span-4">
          <p className="eyebrow text-[0.5rem] text-ink-soft">Selected layout</p>
          <p className="display mt-2 text-xl">{active.name}</p>
          <dl className="mt-5 space-y-3 border-t border-border pt-5 text-sm text-ink-soft">
            <div className="flex justify-between gap-4">
              <dt>Bedrooms</dt>
              <dd className="text-foreground">{active.bedrooms}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Internal area</dt>
              <dd className="text-foreground">{active.size}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Plans</dt>
              <dd className="text-foreground">Issued on appointment</dd>
            </div>
          </dl>

          <ul className="mt-5 flex flex-wrap gap-4 border-t border-border pt-5 text-xs text-ink-soft">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 border border-ink/30" style={{ background: FILLS.living }} />
              Living
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 border border-ink/30" style={{ background: FILLS.wet }} />
              Wet areas
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 border border-ink/30" style={{ background: FILLS.terrace }} />
              Terrace
            </li>
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-ink-soft">
            Plans are indicative. Dimensions and layouts are confirmed in the sale and purchase
            agreement.
          </p>
        </div>
      </div>
    </div>
  )
}
