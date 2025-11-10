import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

type TableStatus = 'running' | 'waiting' | 'starting'

const demoTables: Array<{
  id: string
  name: string
  players: string
  blinds: string
  status: TableStatus
}> = [
  { id: 'A2F9', name: 'Sunset Hold’em', players: '4 / 6', blinds: '1 / 2', status: 'running' },
  { id: 'B7K1', name: 'Midnight Grind', players: '3 / 9', blinds: '2 / 5', status: 'waiting' },
]

const demoTournaments = [
  { id: 'WS-09', name: 'Weekend Shootout', start: '19:00', seats: '23 / 64' },
  { id: 'HR-21', name: 'High Roller', start: '21:30', seats: '12 / 32' },
]

const demoInvites = [
  { host: 'Ali', code: 'QRM9X2', mode: 'private' },
  { host: 'Sara', code: 'LBT7Q4', mode: 'private' },
]

interface LobbySection {
  key: 'activeTables' | 'tournaments' | 'invitations'
  anchor: string
  items: unknown[]
  render: (item: unknown) => JSX.Element
  emptyLabel: string
}

export default function LobbyPage() {
  const { t } = useTranslation()

  const sections: LobbySection[] = useMemo(
    () => [
      {
        key: 'activeTables',
        anchor: 'active-tables',
        items: demoTables,
        render: (table) => {
          const data = table as (typeof demoTables)[number]
          return (
            <div
              key={data.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{data.name}</span>
                <span className="text-xs uppercase text-blue-600 dark:text-blue-300">
                  #{data.id}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-300">
                <div>
                  <span className="block font-semibold">{data.players}</span>
                  <span>{t('lobby.fields.players')}</span>
                </div>
                <div>
                  <span className="block font-semibold">{data.blinds}</span>
                  <span>{t('lobby.fields.blinds')}</span>
                </div>
                <div>
                  <span className="block font-semibold capitalize">
                    {t(`lobby.status.${data.status}` as const)}
                  </span>
                  <span>{t('lobby.fields.status')}</span>
                </div>
              </div>
            </div>
          )
        },
        emptyLabel: t('lobby.activeTables.empty'),
      },
      {
        key: 'tournaments',
        anchor: 'tournaments',
        items: demoTournaments,
        render: (tournament) => {
          const data = tournament as (typeof demoTournaments)[number]
          return (
            <div
              key={data.id}
              className="flex flex-col rounded-xl border border-purple-100 bg-white p-4 shadow-sm dark:border-purple-900/60 dark:bg-gray-800"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{data.name}</span>
                <span className="text-xs uppercase text-purple-600 dark:text-purple-300">
                  #{data.id}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>
                  {t('common.actions.start')}: {data.start}
                </span>
                <span>{data.seats}</span>
              </div>
            </div>
          )
        },
        emptyLabel: t('lobby.tournaments.empty'),
      },
      {
        key: 'invitations',
        anchor: 'invitations',
        items: demoInvites,
        render: (invite) => {
          const data = invite as (typeof demoInvites)[number]
          return (
            <div
              key={data.code}
              className="flex flex-col rounded-xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/60 dark:bg-gray-800"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-sm font-semibold">{data.host}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {data.mode === 'private' ? t('lobby.invitations.private') : data.mode}
                  </span>
                </div>
                <span className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">
                  {data.code}
                </span>
              </div>
            </div>
          )
        },
        emptyLabel: t('lobby.invitations.empty'),
      },
    ],
    [t],
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('lobby.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('menu.lobby.description')}</p>
      </header>

      {sections.map((section) => (
        <section key={section.key} id={section.anchor} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t(`lobby.${section.key}.title`)}</h2>
            {section.key === 'tournaments' ? (
              <button className="text-sm font-medium text-purple-600 dark:text-purple-300">
                {t('lobby.tournaments.cta')}
              </button>
            ) : (
              <button className="text-sm font-medium text-blue-600 dark:text-blue-300">
                {t('lobby.actions.refresh')}
              </button>
            )}
          </div>
          <div className="space-y-3">
            {section.items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                {section.emptyLabel}
              </div>
            ) : (
              section.items.map((item) => section.render(item))
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
