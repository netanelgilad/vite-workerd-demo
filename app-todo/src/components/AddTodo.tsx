import { useState, type FormEvent } from 'react'

interface AddTodoProps {
  onAdd: (title: string) => void
}

export default function AddTodo({ onAdd }: AddTodoProps) {
  const [title, setTitle] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd(title)
    setTitle('')
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done?"
        aria-label="New todo title"
        data-testid="todo-input"
        className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      <button
        type="submit"
        data-testid="add-todo"
        className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
        disabled={!title.trim()}
      >
        Add
      </button>
    </form>
  )
}
