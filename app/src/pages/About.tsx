export default function About() {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold">About</h1>
      <p className="max-w-prose text-sm leading-6 text-slate-600">
        A realistic modern stack: Tailwind v3 (postcss + autoprefixer), React
        Router v7 in library mode, and TanStack Query v5 with mock async data.
      </p>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {['tailwindcss@3', 'react-router@7', '@tanstack/react-query@5'].map(
          (dep) => (
            <div key={dep} className="card">
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                dependency
              </dt>
              <dd className="mt-1 break-all font-mono text-sm">{dep}</dd>
            </div>
          ),
        )}
      </dl>
    </section>
  )
}
