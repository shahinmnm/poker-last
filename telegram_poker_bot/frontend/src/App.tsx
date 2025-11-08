import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { TelegramProvider } from './hooks/useTelegram'
import HomePage from './pages/Home'
import TablePage from './pages/Table'
import StatsPage from './pages/Stats'
import SettingsPage from './pages/Settings'

function App() {
  return (
    <TelegramProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/table/:tableId" element={<TablePage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </BrowserRouter>
    </TelegramProvider>
  )
}

export default App
