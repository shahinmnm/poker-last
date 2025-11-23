import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { TelegramProvider } from './hooks/useTelegram'
import { LocalizationProvider } from './providers/LocalizationProvider'
import { ThemeProvider } from './providers/ThemeProvider'
import { UserDataProvider } from './providers/UserDataProvider'
import { LayoutProvider } from './providers/LayoutProvider'
import MainLayout from './components/MainLayout'
import HomePage from './pages/Home'
import LobbyPage from './pages/Lobby'
import CreateGamePage from './pages/CreateGame'
import JoinGamePage from './pages/JoinGame'
import ProfilePage from './pages/Profile'
import StatsPage from './pages/Stats'
import WalletPage from './pages/Wallet'
import TablePage from './pages/Table'
import GroupInvitePage from './pages/GroupInvite'
import GroupJoinPage from './pages/GroupJoin'
import ArenaUIDemoPage from './pages/ArenaUIDemo'
import { useTelegram } from './hooks/useTelegram'

function StartParamBridge() {
  const { startParam } = useTelegram()
  const navigate = useNavigate()
  const consumedParamRef = useRef<string | null>(null)

  useEffect(() => {
    if (!startParam) {
      return
    }
    if (consumedParamRef.current === startParam) {
      return
    }
    consumedParamRef.current = startParam
    navigate(`/group/join/${startParam}`, { replace: true })
  }, [startParam, navigate])

  return null
}

function App() {
  return (
    <TelegramProvider>
      <LocalizationProvider>
        <ThemeProvider>
          <UserDataProvider>
            <LayoutProvider>
              <BrowserRouter>
                <StartParamBridge />
                <Routes>
                  <Route element={<MainLayout />}>
                    <Route index element={<HomePage />} />
                    <Route path="lobby" element={<LobbyPage />} />
                    <Route path="games">
                      <Route path="create" element={<CreateGamePage />} />
                      <Route path="join" element={<JoinGamePage />} />
                    </Route>
                    <Route path="group">
                      <Route path="invite" element={<GroupInvitePage />} />
                      <Route path="join">
                        <Route index element={<GroupJoinPage />} />
                        <Route path=":gameId" element={<GroupJoinPage />} />
                      </Route>
                    </Route>
                    <Route path="profile">
                      <Route index element={<ProfilePage />} />
                      <Route path="stats" element={<StatsPage />} />
                    </Route>
                    <Route path="wallet" element={<WalletPage />} />
                    <Route path="table/:tableId" element={<TablePage />} />
                    <Route path="demo/arena-ui" element={<ArenaUIDemoPage />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </LayoutProvider>
          </UserDataProvider>
        </ThemeProvider>
      </LocalizationProvider>
    </TelegramProvider>
  )
}

export default App
