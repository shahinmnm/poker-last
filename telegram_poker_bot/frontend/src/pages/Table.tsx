import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TableView } from '../components/table-new/TableView'
import PokerFeltBackground from '../components/background/PokerFeltBackground'
import { useTelegram } from '../hooks/useTelegram'
import Card from '../components/ui/Card'

export default function TablePage() {
  const { tableId } = useParams<{ tableId: string }>()
  const { initData } = useTelegram()
  const { t } = useTranslation()

  if (!tableId) {
    return (
      <Card className="flex min-h-[50vh] items-center justify-center text-sm text-[color:var(--text-muted)]">
        {t('table.notFound')}
      </Card>
    )
  }

  // Auth Check
  if (!initData) {
    return (
      <Card className="flex min-h-[50vh] items-center justify-center text-sm text-[color:var(--text-muted)]">
        {t('table.errors.unauthorized')}
      </Card>
    )
  }

  // Mount the New Engine
  return (
    <PokerFeltBackground>
      <TableView />
    </PokerFeltBackground>
  )
}
