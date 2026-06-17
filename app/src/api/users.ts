export interface User {
  id: string
  name: string
  role: string
  bio: string
}

const USERS: User[] = [
  { id: '1', name: 'Ada Lovelace', role: 'Engineer', bio: 'Wrote the first program.' },
  { id: '2', name: 'Grace Hopper', role: 'Admiral', bio: 'Invented the compiler.' },
  { id: '3', name: 'Alan Turing', role: 'Mathematician', bio: 'Formalized computation.' },
]

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function fetchUsers(): Promise<User[]> {
  await delay(50)
  return USERS
}

export async function fetchUser(id: string): Promise<User> {
  await delay(50)
  const user = USERS.find((u) => u.id === id)
  if (!user) throw new Error(`No user with id ${id}`)
  return user
}
