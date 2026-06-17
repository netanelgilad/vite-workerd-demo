import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { fetchUsers } from '../api/users.ts'

export default function Users() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  if (isPending) return <p className="animate-pulse text-slate-400">Loading…</p>
  if (isError) return <p className="text-red-600">Failed to load users.</p>

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <ul className="space-y-3">
        {data.map((user) => (
          <li key={user.id} className="card flex items-center justify-between">
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-sm text-slate-500">{user.role}</p>
            </div>
            <Link
              to={`/users/${user.id}`}
              className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-500 hover:text-white"
            >
              View
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
