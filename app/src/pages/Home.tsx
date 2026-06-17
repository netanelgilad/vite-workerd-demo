import { Link } from 'react-router'

export default function Home() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">
        Vite inside <span className="text-brand-500">workerd</span>
      </h1>
      <p className="max-w-prose text-slate-600">
        This app exercises Tailwind CSS v3, React Router v7 and TanStack Query
        v5 — built and dev-served entirely inside a V8 isolate.
      </p>
      <div className="card">
        <h2 className="mb-2 text-lg font-semibold">Try the routes</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
          <li>
            <Link className="text-brand-700 underline" to="/users">
              Users list (TanStack Query)
            </Link>
          </li>
          <li>
            <Link className="text-brand-700 underline" to="/users/2">
              Dynamic route: /users/2
            </Link>
          </li>
        </ul>
      </div>
    </section>
  )
}
