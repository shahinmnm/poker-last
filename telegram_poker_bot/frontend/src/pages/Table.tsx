import { TableView } from '../components/table-new/TableView'
import PokerFeltBackground from '../components/background/PokerFeltBackground'
import { useTelegram } from '../hooks/useTelegram'

export default function TablePage() {
  const { initData } = useTelegram()
  
  if (!initData) return <div className="text-white p-10 text-center">Unauthorized</div>

  return (
    <PokerFeltBackground>
      <TableView />
    </PokerFeltBackground>
  )
}
