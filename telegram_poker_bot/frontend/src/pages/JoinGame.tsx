import { FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

const recentInvites = [
  { code: 'MKD8Q2', host: 'Nima', createdAt: '2h' },
  { code: 'PQL7W9', host: 'Ava', createdAt: '1d' },
]

export default function JoinGamePage() {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (code.trim().length !== 6) {
      setError(t('joinGame.form.invalidCode'))
      return
    }
    setError(null)
    setJoined(true)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('joinGame.title')}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t('joinGame.description')}</p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="invite-code">
            {t('joinGame.form.codeLabel')}
          </label>
          <input
            id="invite-code"
            type="text"
            value={code.toUpperCase()}
            maxLength={6}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase())
              setJoined(false)
            }}
            placeholder={t('joinGame.form.codePlaceholder') ?? ''}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase tracking-widest dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            {t('joinGame.form.joinButton')}
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            {t('joinGame.form.scanButton')}
          </button>
        </div>
      </form>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('joinGame.recent.title')}</h2>
        <div className="mt-3 space-y-3">
          {recentInvites.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('joinGame.recent.empty')}</p>
          ) : (
            recentInvites.map((invite) => (
              <div
                key={invite.code}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-gray-700"
              >
                <div>
                  <p className="font-semibold">{invite.code}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {invite.host} · {invite.createdAt}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-blue-500 px-3 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950/40"
                  onClick={() => {
                    setCode(invite.code)
                    setJoined(false)
                  }}
                >
                  {t('common.actions.join')}
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {joined && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          {t('joinGame.success')}
        </div>
      )}
    </div>
  )
}
