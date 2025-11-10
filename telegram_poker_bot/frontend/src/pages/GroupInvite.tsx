import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch, ApiError } from '../lib/apiClient'
import Toast from '../components/Toast'

interface InviteResponse {
  game_id: string
  deep_link: string
  startapp_link: string
  expires_at: string
  status: string
}

type RequestState = 'idle' | 'loading' | 'loaded' | 'error'

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
  const [state, setState] = useState<RequestState>('idle')
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    if (!ready) {
      return
    }
    if (!initData) {
      setErrorKey('groupInvite.errors.missingInit')
      setState('error')
      return
    }
    if (state === 'idle') {
      createInvite(initData)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const response = await apiFetch<InviteResponse>('/group-games/invites', {
        method: 'POST',
        initData: authData,
      })
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

  const handleCopy = async () => {
    if (!invite) {
      return
    }
    try {
      await copyTextToClipboard(invite.deep_link)
      setShowToast(true)
      window.setTimeout(() => setShowToast(false), 2000)
    } catch {
      setErrorKey('groupInvite.errors.copyFailed')
    }
  }

  const handleRegenerate = () => {
    if (!initData) {
      setErrorKey('groupInvite.errors.missingInit')
      setState('error')
      return
    }
    createInvite(initData)
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
            {t('groupInvite.title')}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('groupInvite.subtitle', { name: creatorName })}
          </p>
        </div>

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
            <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left dark:border-[#2B2B2B] dark:bg-[#1F1F1F]">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('groupInvite.fields.linkLabel')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={invite.deep_link}
                  className="flex-1 truncate rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none dark:border-[#333333] dark:bg-[#121212] dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 rounded-xl bg-[#007BFF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#006AE0]"
                >
                  {t('groupInvite.actions.copy')}
                </button>
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
                {t('groupInvite.actions.regenerate')}
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
      <Toast message={t('groupInvite.toast.copied')} visible={showToast} />
    </div>
  )
}
