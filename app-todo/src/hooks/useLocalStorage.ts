import { useEffect, useState } from 'react'

// Persist a piece of state to localStorage under `key`. SSR/headless-safe:
// reads lazily on first render, writes on every change.
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* quota / unavailable — ignore, state still works in-memory */
    }
  }, [key, value])

  return [value, setValue] as const
}
