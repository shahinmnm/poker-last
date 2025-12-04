import LobbyView from '../components/lobby-new/LobbyView'

export default function LobbyNewPage() {
  // LobbyView handles navigation internally via LobbyRow's default behavior
  // which navigates to /table/:tableId when a table is clicked
  return <LobbyView />
}
