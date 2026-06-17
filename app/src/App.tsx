import { NavLink, Route, Routes } from 'react-router'
import About from './pages/About.tsx'
import Home from './pages/Home.tsx'
import UserDetail from './pages/UserDetail.tsx'
import Users from './pages/Users.tsx'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <span className="mr-4 text-lg font-bold text-brand-700">app-modern</span>
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/users" className={navLinkClass}>
            Users
          </NavLink>
          <NavLink to="/about" className={navLinkClass}>
            About
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:userId" element={<UserDetail />} />
          <Route
            path="*"
            element={<p className="text-sm text-red-600">Not found</p>}
          />
        </Routes>
      </main>
    </div>
  )
}
