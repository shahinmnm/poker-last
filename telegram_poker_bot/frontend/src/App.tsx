import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TelegramProvider } from './hooks/useTelegram'
import { LocalizationProvider } from './providers/LocalizationProvider'
import MainLayout from './components/MainLayout'
import HomePage from './pages/Home'
import LobbyPage from './pages/Lobby'
import CreateGamePage from './pages/CreateGame'
import JoinGamePage from './pages/JoinGame'
import ProfilePage from './pages/Profile'
import StatsPage from './pages/Stats'
import WalletPage from './pages/Wallet'
import SettingsPage from './pages/Settings'
import HelpPage from './pages/Help'
import TablePage from './pages/Table'

function App() {
  return (
    <TelegramProvider>
      <LocalizationProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route path="lobby" element={<LobbyPage />} />
              <Route path="games">
                <Route path="create" element={<CreateGamePage />} />
                <Route path="join" element={<JoinGamePage />} />
              </Route>
              <Route path="profile">
                <Route index element={<ProfilePage />} />
                <Route path="stats" element={<StatsPage />} />
              </Route>
              <Route path="wallet" element={<WalletPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="help" element={<HelpPage />} />
            </Route>
            <Route path="/table/:tableId" element={<TablePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LocalizationProvider>
    </TelegramProvider>
  )
}

export default App
