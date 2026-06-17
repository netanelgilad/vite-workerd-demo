import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { fetchUser } from '../api/users.ts'

export default function UserDetail() {
  const { userId } = useParams<{ userId: string }>()
  const { data, isPending, isError } = useQuery({
    queryKey: ['users', userId],
    queryFn: () => fetchUser(userId!),
    enabled: Boolean(userId),
  })

  if (isPending) return <p className="animate-pulse text-slate-400">Loading…</p>
  if (isError || !data)
    return <p className="text-red-600">User {userId} not found.</p>

  return (
    <section className="space-y-4">
      <Link to="/users" className="text-sm text-brand-700 underline">
        &larr; Back to users
      </Link>
      <div className="card">
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <p className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
          {data.role}
        </p>
        <p className="mt-4 text-sm leading-6 text-slate-600">{data.bio}</p>
      </div>
    </section>
  )
}
