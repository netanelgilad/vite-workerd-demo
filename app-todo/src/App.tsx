import AddTodo from './components/AddTodo.tsx'
import Filters from './components/Filters.tsx'
import TodoList from './components/TodoList.tsx'
import { useTodos } from './hooks/useTodos.ts'

export default function App() {
  const {
    visibleTodos,
    filter,
    setFilter,
    addTodo,
    toggleTodo,
    deleteTodo,
    clearCompleted,
    remaining,
    completedCount,
  } = useTodos()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-xl px-4 py-12">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-brand-700">
            ToDo
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Vite + React + TypeScript, served from inside workerd.
          </p>
        </header>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 p-4">
            <AddTodo onAdd={addTodo} />
          </div>

          <TodoList
            todos={visibleTodos}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
          />

          <Filters
            filter={filter}
            onChange={setFilter}
            remaining={remaining}
            completedCount={completedCount}
            onClearCompleted={clearCompleted}
          />
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Your todos persist in localStorage.
        </p>
      </main>
    </div>
  )
}
