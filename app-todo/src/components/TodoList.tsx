import type { Todo } from '../types.ts'
import TodoItem from './TodoItem.tsx'

interface TodoListProps {
  todos: Todo[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}

export default function TodoList({ todos, onToggle, onDelete }: TodoListProps) {
  if (todos.length === 0) {
    return (
      <p
        data-testid="empty-state"
        className="px-4 py-10 text-center text-sm text-slate-400"
      >
        Nothing here. Add a todo above to get started.
      </p>
    )
  }

  return (
    <ul data-testid="todo-list" className="divide-y divide-slate-100">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </ul>
  )
}
