import { useMemo, useState } from 'react'
import type { Filter, Todo } from '../types.ts'
import { useLocalStorage } from './useLocalStorage.ts'

const STORAGE_KEY = 'app-todo.todos.v1'

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// All ToDo state + behavior lives here so the components stay pure UI.
export function useTodos() {
  const [todos, setTodos] = useLocalStorage<Todo[]>(STORAGE_KEY, [])
  const [filter, setFilter] = useState<Filter>('all')

  const addTodo = (title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    setTodos((prev) => [
      ...prev,
      { id: makeId(), title: trimmed, completed: false, createdAt: Date.now() },
    ])
  }

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    )
  }

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }

  const clearCompleted = () => {
    setTodos((prev) => prev.filter((t) => !t.completed))
  }

  const visibleTodos = useMemo(() => {
    if (filter === 'active') return todos.filter((t) => !t.completed)
    if (filter === 'completed') return todos.filter((t) => t.completed)
    return todos
  }, [todos, filter])

  const remaining = useMemo(() => todos.filter((t) => !t.completed).length, [todos])
  const completedCount = todos.length - remaining

  return {
    todos,
    visibleTodos,
    filter,
    setFilter,
    addTodo,
    toggleTodo,
    deleteTodo,
    clearCompleted,
    remaining,
    completedCount,
  }
}
