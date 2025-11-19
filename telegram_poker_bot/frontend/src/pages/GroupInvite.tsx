import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch, ApiError } from '../utils/apiClient'
import Toast from '../components/Toast'

interface InviteResponse {
  game_id: string
  deep_link: string
  startapp_link: string
  expires_at: string
  status: string
}

type RequestState = 'idle' | 'configuring' | 'loading' | 'loaded' | 'error'

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

export default function GroupInvitePage() {
  const { t } = useTranslation()
  const { initData, ready, user } = useTelegram()
  const [invite, setInvite] = useState<InviteResponse | null>(null)
  const [state, setState] = useState<RequestState>('configuring')
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const canUseNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  // Table configuration
  const [tableName, setTableName] = useState('')
  const [smallBlind, setSmallBlind] = useState(25)
  const [bigBlind, setBigBlind] = useState(50)
  const [startingStack, setStartingStack] = useState(10000)
  const [maxPlayers, setMaxPlayers] = useState(8)

  useEffect(() => {
    if (!ready) {
      return
    }
    if (!initData) {
      setErrorKey('groupInvite.errors.missingInit')
      setState('error')
      return
    }
    // Start in configuring mode - user needs to set table parameters
  }, [ready, initData])

  const creatorName = useMemo(() => {
    if (!user) {
      return ''
    }
    return user.first_name || user.username || ''
  }, [user])

  const createInvite = async (authData: string) => {
    setState('loading')
    setErrorKey(null)
    try {
      const response = await apiFetch<InviteResponse>(
        `/group-games/invites?small_blind=${smallBlind}&big_blind=${bigBlind}&starting_stack=${startingStack}&max_players=${maxPlayers}&table_name=${encodeURIComponent(tableName || `${creatorName}'s Table`)}`,
        {
          method: 'POST',
          initData: authData,
        }
      )
      setInvite(response)
      setState('loaded')
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null
      if (apiError?.status === 401) {
        setErrorKey('groupInvite.errors.unauthorized')
      } else {
        setErrorKey('groupInvite.errors.requestFailed')
      }
      setState('error')
    }
  }

  const handleCopy = async (value: string, toastKey: string = 'groupInvite.toast.copied') => {
    if (!value) {
      return
    }
    try {
      await copyTextToClipboard(value)
      setToastMessage(t(toastKey))
      setShowToast(true)
      window.setTimeout(() => setShowToast(false), 2000)
    } catch {
      setErrorKey('groupInvite.errors.copyFailed')
    }
  }

  const handleShare = async () => {
    if (!invite || !canUseNativeShare) {
      return
    }
    try {
      await navigator.share({
        title: t('groupInvite.share.title'),
        text: t('groupInvite.share.text', { link: invite.deep_link }),
        url: invite.deep_link,
      })
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') {
        return
      }
      setErrorKey('groupInvite.errors.shareFailed')
    }
  }

  const handleCreateTable = () => {
    if (!initData) {
      setErrorKey('groupInvite.errors.missingInit')
      setState('error')
      return
    }
    createInvite(initData)
  }

  const handleRegenerate = () => {
    setState('configuring')
    setInvite(null)
  }

  const expiresAtText = useMemo(() => {
    if (!invite) {
      return ''
    }
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(invite.expires_at))
    } catch {
      return invite.expires_at
    }
  }, [invite])

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm dark:bg-black/60" />
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-[#2B2B2B] dark:bg-[#1F1F1F]">
        <div className="mb-6 space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {state === 'configuring' ? 'Create Private Table' : t('groupInvite.title')}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {state === 'configuring'
              ? 'Configure your table settings'
              : t('groupInvite.subtitle', { name: creatorName })}
          </p>
        </div>

        {state === 'configuring' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Table Name (optional)
              </label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder={`${creatorName}'s Table`}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none dark:border-[#333333] dark:bg-[#121212] dark:text-gray-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Small Blind
                </label>
                <input
                  type="number"
                  value={smallBlind}
                  onChange={(e) => setSmallBlind(Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none dark:border-[#333333] dark:bg-[#121212] dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Big Blind
                </label>
                <input
                  type="number"
                  value={bigBlind}
                  onChange={(e) => setBigBlind(Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none dark:border-[#333333] dark:bg-[#121212] dark:text-gray-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Starting Stack
                </label>
                <input
                  type="number"
                  value={startingStack}
                  onChange={(e) => setStartingStack(Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none dark:border-[#333333] dark:bg-[#121212] dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Max Players
                </label>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none dark:border-[#333333] dark:bg-[#121212] dark:text-gray-100"
                >
                  {[2, 4, 6, 8, 9].map((n) => (
                    <option key={n} value={n}>
                      {n} players
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateTable}
              className="w-full rounded-xl bg-[#1E88E5] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#166FC1]"
            >
              Create Table & Generate Invite
            </button>
          </div>
        )}

        {state === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-10 text-sm text-gray-600 dark:text-gray-300">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <span>{t('groupInvite.status.generating')}</span>
          </div>
        )}

          {state === 'error' && (
            <div className="space-y-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              <p>{errorKey ? t(errorKey) : t('groupInvite.errors.requestFailed')}</p>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  {t('groupInvite.actions.retry')}
                </button>
              </div>
            </div>
          )}

          {state === 'loaded' && invite && (
            <div className="space-y-6">
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left dark:border-[#2B2B2B] dark:bg-[#1F1F1F]">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
                  <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                    ✅ Table Created
                  </h3>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                    {tableName || `${creatorName}'s Table`} • {smallBlind}/{bigBlind} blinds • {maxPlayers} max players
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('groupInvite.fields.linkLabel')}
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      readOnly
                      value={invite.deep_link}
                      className="flex-1 truncate rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none dark:border-[#333333] dark:bg-[#121212] dark:text-gray-100"
                    />
                    <div className="flex w-full gap-2 sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleCopy(invite.deep_link, 'groupInvite.toast.copiedGroupLink')}
                        className="flex-1 rounded-xl bg-[#007BFF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#006AE0]"
                      >
                        {t('groupInvite.actions.copy')}
                      </button>
                      {canUseNativeShare && (
                        <button
                          type="button"
                          onClick={handleShare}
                          className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-slate-100 dark:border-[#333333] dark:bg-[#1F1F1F] dark:text-gray-100"
                        >
                          {t('groupInvite.actions.share')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('groupInvite.fields.miniAppLinkLabel')}
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      readOnly
                      value={invite.startapp_link}
                      className="flex-1 truncate rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none dark:border-[#333333] dark:bg-[#121212] dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(invite.startapp_link, 'groupInvite.toast.copiedMiniAppLink')}
                      className="w-full rounded-xl bg-[#007BFF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#006AE0] sm:w-auto"
                    >
                      {t('groupInvite.actions.copy')}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-300">
                  {t('groupInvite.meta.expires', { value: expiresAtText })}
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-gray-700 shadow-sm dark:border-[#2B2B2B] dark:bg-[#1F1F1F] dark:text-gray-200">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {t('groupInvite.instructions.title')}
                </h2>
                <ol className="mt-3 space-y-2 text-left">
                  <li>• {t('groupInvite.instructions.forward')}</li>
                  <li>• {t('groupInvite.instructions.telegramMessage')}</li>
                  <li>• {t('groupInvite.instructions.addBot')}</li>
                </ol>
              </section>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-slate-100 dark:border-[#333333] dark:text-gray-100 dark:hover:bg-[#1F1F1F] sm:w-auto"
                >
                  Create Another Table
                </button>
                <a
                  href={invite.startapp_link}
                  className="w-full rounded-xl bg-[#1E88E5] px-4 py-2 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-[#166FC1] sm:w-auto"
                >
                  {t('groupInvite.actions.openMiniApp')}
                </a>
              </div>
            </div>
          )}
        </div>
        <Toast message={toastMessage || t('groupInvite.toast.copied')} visible={showToast} />
    </div>
  )
}
