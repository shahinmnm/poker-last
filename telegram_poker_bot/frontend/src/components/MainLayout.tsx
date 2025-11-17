import { Outlet } from 'react-router-dom'

import BottomNav from './BottomNav'

export default function MainLayout() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[var(--color-bg-gradient)]" />
        <div className="absolute inset-x-0 bottom-[-28%] h-72 bg-[radial-gradient(circle_at_center,rgba(34,242,239,0.18),transparent_60%)] blur-3xl" />
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 pb-32 pt-[calc(18px+env(safe-area-inset-top))] sm:px-6">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
