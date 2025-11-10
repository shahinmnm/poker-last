import { FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface CreateGameFormState {
  name: string
  variant: 'holdem' | 'shortDeck' | 'plo'
  buyIn: number
  maxPlayers: number
  privacy: 'private' | 'public'
  autoStart: boolean
}

const variantOptions: Array<CreateGameFormState['variant']> = ['holdem', 'shortDeck', 'plo']
const privacyOptions: Array<CreateGameFormState['privacy']> = ['private', 'public']

export default function CreateGamePage() {
  const { t } = useTranslation()
  const [formState, setFormState] = useState<CreateGameFormState>({
    name: '',
    variant: 'holdem',
    buyIn: 500,
    maxPlayers: 6,
    privacy: 'private',
    autoStart: true,
  })
  const [submitted, setSubmitted] = useState(false)
  const tips = t('createGame.tips', { returnObjects: true }) as string[]

  const handleChange = (field: keyof CreateGameFormState, value: string | number | boolean) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('createGame.title')}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t('createGame.description')}</p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="table-name">
            {t('createGame.form.name')}
          </label>
          <input
            id="table-name"
            type="text"
            value={formState.name}
            onChange={(event) => handleChange('name', event.target.value)}
            placeholder={t('createGame.form.namePlaceholder') ?? ''}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="variant">
              {t('createGame.form.variant')}
            </label>
            <select
              id="variant"
              value={formState.variant}
              onChange={(event) =>
                handleChange('variant', event.target.value as CreateGameFormState['variant'])
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              {variantOptions.map((variant) => (
                <option key={variant} value={variant}>
                  {t(`createGame.form.variantOptions.${variant}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="buy-in">
              {t('createGame.form.buyIn')}
            </label>
            <input
              id="buy-in"
              type="number"
              min={0}
              value={formState.buyIn}
              onChange={(event) => handleChange('buyIn', Number(event.target.value))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-300 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="max-players">
              {t('createGame.form.maxPlayers')}
            </label>
            <input
              id="max-players"
              type="number"
              min={2}
              max={9}
              value={formState.maxPlayers}
              onChange={(event) => handleChange('maxPlayers', Number(event.target.value))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-300 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="privacy">
              {t('createGame.form.privacy')}
            </label>
            <select
              id="privacy"
              value={formState.privacy}
              onChange={(event) =>
                handleChange('privacy', event.target.value as CreateGameFormState['privacy'])
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              {privacyOptions.map((privacy) => (
                <option key={privacy} value={privacy}>
                  {t(`createGame.form.privacyOptions.${privacy}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={formState.autoStart}
            onChange={(event) => handleChange('autoStart', event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
          />
          {t('createGame.form.autoStart')}
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          {t('createGame.form.button')}
        </button>
      </form>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('createGame.tipsTitle')}</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
          {tips.map((tip, index) => (
            <li key={index}>• {tip}</li>
          ))}
        </ul>
      </section>

      {submitted && (
        <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 p-5 text-sm text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
          {t('createGame.success')}
        </div>
      )}
    </div>
  )
}
