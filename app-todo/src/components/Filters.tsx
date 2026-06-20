import type { Filter } from '../types.ts'

interface FiltersProps {
  filter: Filter
  onChange: (filter: Filter) => void
  remaining: number
  completedCount: number
  onClearCompleted: () => void
}

const FILTERS: Filter[] = ['all', 'active', 'completed']

export default function Filters({
  filter,
  onChange,
  remaining,
  completedCount,
  onClearCompleted,
}: FiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm">
      <span data-testid="remaining-count" className="text-slate-500">
        {remaining} item{remaining === 1 ? '' : 's'} left
      </span>
      <div className="flex gap-1" role="group" aria-label="Filter todos">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            data-testid={`filter-${f}`}
            aria-pressed={filter === f}
            className={`rounded-md px-3 py-1 capitalize transition ${
              filter === f
                ? 'bg-brand-500 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onClearCompleted}
        data-testid="clear-completed"
        disabled={completedCount === 0}
        className="text-slate-400 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-slate-400"
      >
        Clear completed
      </button>
    </div>
  )
}
