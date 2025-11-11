import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch, ApiError } from '../utils/apiClient'
import { upsertRecentInvite } from '../utils/recentInvites'

interface InviteStatusResponse {
  game_id: string
  deep_link: string
  status: string
  expires_at: string
  group_id?: number | null
  group_title?: string | null
}

interface InviteJoinResponse {
  game_id: string
  status: string
  message: string
  group_title?: string | null
}

interface UserProfileResponse {
  registered: boolean
  user_id?: number
  username?: string | null
  language: string
  first_name?: string | null
  last_name?: string | null
}

type ViewState = 'loading' | 'requiresRegistration' | 'joining' | 'ready' | 'error' | 'missing'

export default function GroupJoinPage() {
  const { t } = useTranslation()
  const params = useParams<{ gameId?: string }>()
  const { startParam, initData, ready } = useTelegram()
  const navigate = useNavigate()

  const [view, setView] = useState<ViewState>('loading')
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [inviteStatus, setInviteStatus] = useState<InviteStatusResponse | null>(null)
  const [joinResponse, setJoinResponse] = useState<InviteJoinResponse | null>(null)

  const gameId = useMemo(() => params.gameId || startParam || null, [params.gameId, startParam])

  useEffect(() => {
    if (!ready) {
      return
    }
    if (!gameId) {
      setView('missing')
      return
    }
    if (!initData) {
      setErrorKey('groupJoin.errors.missingInit')
      setView('error')
      return
    }

    const load = async () => {
      try {
        setView('loading')
        const invite = await apiFetch<InviteStatusResponse>(`/group-games/invites/${gameId}`, {
          method: 'GET',
        })
        setInviteStatus(invite)

        const profile = await apiFetch<UserProfileResponse>('/users/me', {
          method: 'GET',
          initData,
        })

        if (!profile.registered) {
          setView('requiresRegistration')
          return
        }

        await joinInvite(gameId, initData)
      } catch (error) {
        handleError(error)
      }
    }

    load()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, initData, ready])

  const joinInvite = async (id: string, authData: string) => {
    try {
      setView('joining')
      const response = await apiFetch<InviteJoinResponse>(`/group-games/invites/${id}/attend`, {
        method: 'POST',
        initData: authData,
      })
      setJoinResponse(response)
      upsertRecentInvite({
        gameId: response.game_id,
        status: response.status,
        groupTitle: response.group_title ?? inviteStatus?.group_title ?? null,
      })
      setView('ready')
    } catch (error) {
      handleError(error)
    }
  }

  const handleRegister = async () => {
    if (!initData || !gameId) {
      setErrorKey('groupJoin.errors.missingInit')
      setView('error')
      return
    }
    try {
      setView('joining')
      await apiFetch<UserProfileResponse>('/users/register', {
        method: 'POST',
        initData,
      })
      await joinInvite(gameId, initData)
    } catch (error) {
      handleError(error)
    }
  }

  const handleError = (error: unknown) => {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        setErrorKey('groupJoin.errors.notFound')
      } else if (error.status === 410) {
        setErrorKey('groupJoin.errors.expired')
      } else if (error.status === 401) {
        setErrorKey('groupJoin.errors.missingInit')
      } else {
        setErrorKey('groupJoin.errors.requestFailed')
      }
    } else {
      setErrorKey('groupJoin.errors.requestFailed')
    }
    setView('error')
  }

  if (view === 'missing') {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 px-4 text-center text-sm text-gray-600 dark:text-gray-300">
        <p>{t('groupJoin.missingParam')}</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          {t('groupJoin.actions.backHome')}
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg dark:border-[#2B2B2B] dark:bg-[#1F1F1F]">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {t('groupJoin.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('groupJoin.subtitle')}</p>
        </div>

        {view === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-8 text-sm text-gray-600 dark:text-gray-300">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <span>{t('groupJoin.status.loading')}</span>
          </div>
        )}

        {view === 'requiresRegistration' && (
          <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            <p>{t('groupJoin.register.message')}</p>
            <button
              type="button"
              onClick={handleRegister}
              className="w-full rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
            >
              {t('groupJoin.register.action')}
            </button>
          </div>
        )}

        {view === 'joining' && (
          <div className="flex flex-col items-center gap-4 py-8 text-sm text-gray-600 dark:text-gray-300">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <span>{t('groupJoin.status.joining')}</span>
          </div>
        )}

        {view === 'ready' && joinResponse && (
          <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
            {inviteStatus?.group_title && (
              <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                {t('groupJoin.meta.groupLabel', { title: inviteStatus.group_title })}
              </p>
            )}
            <p className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
              {joinResponse.message}
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
              <a
                href={`/table/${joinResponse.game_id}`}
                className="w-full rounded-xl bg-[#1E88E5] px-4 py-2 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-[#166FC1] sm:w-auto"
              >
                {t('groupJoin.actions.openTable')}
              </a>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-slate-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800 sm:w-auto"
              >
                {t('groupJoin.actions.backHome')}
              </button>
            </div>
          </div>
        )}

        {view === 'error' && (
          <div className="space-y-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
            <p>{errorKey ? t(errorKey) : t('groupJoin.errors.requestFailed')}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-700 dark:text-red-200 dark:hover:bg-red-900/40"
              >
                {t('groupJoin.actions.backHome')}
              </button>
              {initData && gameId && (
                  <button
                    type="button"
                    onClick={() => joinInvite(gameId, initData)}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                  >
                  {t('groupJoin.actions.retry')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
