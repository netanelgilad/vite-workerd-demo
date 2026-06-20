import type { Todo } from '../types.ts'

interface TodoItemProps {
  todo: Todo
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}

export default function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  return (
    <li
      data-testid="todo-item"
      data-completed={todo.completed}
      className="flex items-center gap-3 px-4 py-3"
    >
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
        aria-label={`Toggle ${todo.title}`}
        data-testid="todo-toggle"
        className="h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-brand-500 focus:ring-brand-500"
      />
      <span
        data-testid="todo-title"
        className={`flex-1 text-sm ${
          todo.completed ? 'text-slate-400 line-through' : 'text-slate-800'
        }`}
      >
        {todo.title}
      </span>
      <button
        type="button"
        onClick={() => onDelete(todo.id)}
        aria-label={`Delete ${todo.title}`}
        data-testid="todo-delete"
        className="rounded-md px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-red-50 hover:text-red-600"
      >
        Delete
      </button>
    </li>
  )
}
