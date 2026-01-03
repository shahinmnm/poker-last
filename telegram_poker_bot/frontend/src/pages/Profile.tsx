import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUser,
  faCoins,
  faTrophy,
  faChartLine,
  faLanguage,
  faVolumeHigh,
  faPalette,
  faCircleQuestion,
  faChevronDown,
  faChevronUp,
  faMedal,
  faLock,
  faCheck,
} from '@fortawesome/free-solid-svg-icons'

import { useTelegram } from '../hooks/useTelegram'
import { useTheme } from '../providers/ThemeProvider'
import { useUserData } from '../providers/UserDataProvider'
import { formatMoney } from '../utils/currency'

type DropdownKey = 'language' | 'theme' | 'help' | null

export default function ProfilePage() {
  const { t, i18n } = useTranslation()
  const { user } = useTelegram()
  const { mode, setMode } = useTheme()
  const { stats, balanceReal, loading } = useUserData()
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = window.localStorage.getItem('pokerbot.sound')
    return stored !== 'false'
  })

  const toggleDropdown = (key: DropdownKey) => {
    setOpenDropdown(openDropdown === key ? null : key)
  }

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
    setOpenDropdown(null)
  }

  const changeTheme = (newMode: 'light' | 'dark') => {
    setMode(newMode)
    setOpenDropdown(null)
  }

  const toggleSound = () => {
    const newValue = !soundEnabled
    setSoundEnabled(newValue)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pokerbot.sound', String(newValue))
    }
  }

  const currentLangBadge = i18n.language === 'fa' ? t('profile.settings.languageBadge.fa') : t('profile.settings.languageBadge.en')

  if (loading) {
    return (
      <div
        className="profile-panel flex min-h-[40vh] items-center justify-center"
      >
        <p className="text-sm ui-muted">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 page-stack">
      <div className="profile-panel p-6">
        <div className="flex items-center gap-4">
          <div className="profile-tile flex h-16 w-16 items-center justify-center">
            <FontAwesomeIcon icon={faUser} className="text-2xl" style={{ color: 'var(--color-text)' }} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
              {user?.first_name} {user?.last_name}
            </h1>
            {user?.username && (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                @{user.username}
              </p>
            )}
          </div>
          <button
            disabled
            className="profile-tile px-3 py-2 text-xs font-medium opacity-50 cursor-not-allowed"
          >
            {t('profile.edit')}
          </button>
        </div>
      </div>

      <div className="profile-stats-grid">
        {[
          {
            icon: faTrophy,
            label: t('profile.stats.games'),
            value: stats?.hands_played || 0,
          },
          {
            icon: faChartLine,
            label: t('profile.stats.winRate'),
            value: stats ? `${stats.win_rate.toFixed(1)}%` : '0%',
          },
          {
            icon: faCoins,
            label: t('profile.stats.profit'),
            value: stats?.total_profit !== undefined
              ? (stats.total_profit >= 0 ? `+${stats.total_profit}` : stats.total_profit)
              : '0',
            color: stats && stats.total_profit >= 0 ? 'var(--color-success-text)' : 'var(--color-danger)',
          },
          {
            icon: faCoins,
            label: t('profile.balance'),
            value: balanceReal !== null ? formatMoney(balanceReal) : '...',
            color: 'var(--color-accent)',
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="profile-tile p-4"
          >
            <FontAwesomeIcon
              icon={stat.icon}
              className="mb-2 text-lg"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {stat.label}
            </p>
            <p
              className="mt-1 text-lg font-bold"
              style={{ color: stat.color || 'var(--color-text)' }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="profile-panel p-4">
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('profile.achievements.title')}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('profile.achievements.firstWin'), locked: true },
            { label: t('profile.achievements.bigPot'), locked: true },
            { label: t('profile.achievements.streak'), locked: true },
          ].map((badge, idx) => (
            <div
              key={idx}
              className="profile-tile flex flex-col items-center gap-2 p-3"
              style={{ opacity: badge.locked ? 0.5 : 1 }}
            >
              <FontAwesomeIcon
                icon={badge.locked ? faLock : faMedal}
                className="text-xl"
                style={{ color: 'var(--color-text-muted)' }}
              />
              <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                {badge.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div
        className="poker-panel p-4"
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('profile.missions.title')}
        </h2>
        <div
          className="poker-tile p-3"
          style={{
            opacity: 0.6,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {t('profile.missions.playHands', { count: 10 })}
            </p>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>0/10</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'var(--glass-bg)' }}>
            <div className="h-full rounded-full" style={{ width: '0%', background: 'var(--color-accent)' }} />
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t('profile.missions.reward')}: 100 {t('profile.chips')}
          </p>
        </div>
      </div>

      <div
        className="poker-panel p-4"
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('profile.settings.title')}
        </h2>
        <div className="space-y-2">
          <div>
            <button
              onClick={() => toggleDropdown('language')}
              className="poker-tile flex w-full items-center justify-between p-3 text-left transition-transform active:scale-98"
            >
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faLanguage} style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {t('profile.settings.language')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'var(--glass-bg)', color: 'var(--color-text)' }}>
                  {currentLangBadge}
                </span>
                <FontAwesomeIcon icon={openDropdown === 'language' ? faChevronUp : faChevronDown} className="text-xs" style={{ color: 'var(--color-text-muted)' }} />
              </div>
            </button>
            {openDropdown === 'language' && (
              <div className="mt-2 space-y-1 px-2">
                {[
                  { code: 'fa', label: t('languages.fa') },
                  { code: 'en', label: t('languages.en') },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-left"
                    style={{
                      background: i18n.language === lang.code ? 'var(--glass-bg)' : 'transparent',
                    }}
                  >
                    <span className="text-sm" style={{ color: 'var(--color-text)' }}>{lang.label}</span>
                    {i18n.language === lang.code && (
                      <FontAwesomeIcon icon={faCheck} className="text-xs" style={{ color: 'var(--color-accent)' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <button
              onClick={() => toggleDropdown('theme')}
              className="poker-tile flex w-full items-center justify-between p-3 text-left transition-transform active:scale-98"
            >
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faPalette} style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {t('profile.settings.theme')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {mode === 'dark' ? t('profile.settings.themeDark') : t('profile.settings.themeLight')}
                </span>
                <FontAwesomeIcon icon={openDropdown === 'theme' ? faChevronUp : faChevronDown} className="text-xs" style={{ color: 'var(--color-text-muted)' }} />
              </div>
            </button>
            {openDropdown === 'theme' && (
              <div className="mt-2 space-y-1 px-2">
                {[
                  { value: 'dark', label: t('profile.settings.themeDark') },
                  { value: 'light', label: t('profile.settings.themeLight') },
                ].map((themeOption) => (
                  <button
                    key={themeOption.value}
                    onClick={() => changeTheme(themeOption.value as 'light' | 'dark')}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-left"
                    style={{
                      background: mode === themeOption.value ? 'var(--glass-bg)' : 'transparent',
                    }}
                  >
                    <span className="text-sm" style={{ color: 'var(--color-text)' }}>{themeOption.label}</span>
                    {mode === themeOption.value && (
                      <FontAwesomeIcon icon={faCheck} className="text-xs" style={{ color: 'var(--color-accent)' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={toggleSound}
            className="poker-tile flex w-full items-center justify-between p-3 text-left transition-transform active:scale-98"
          >
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faVolumeHigh} style={{ color: 'var(--color-text-muted)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                {t('profile.settings.sound')}
              </span>
            </div>
            <div
              className="relative h-5 w-9 rounded-full transition-colors"
              style={{
                background: soundEnabled ? 'var(--color-accent)' : 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <div
                className="absolute top-0.5 h-4 w-4 rounded-full transition-transform"
                style={{
                  background: 'var(--color-text)',
                  transform: soundEnabled ? 'translateX(1rem)' : 'translateX(0.125rem)',
                }}
              />
            </div>
          </button>

          <div>
            <button
              onClick={() => toggleDropdown('help')}
              className="poker-tile flex w-full items-center justify-between p-3 text-left transition-transform active:scale-98"
            >
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faCircleQuestion} style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {t('profile.settings.help')}
                </span>
              </div>
              <FontAwesomeIcon icon={openDropdown === 'help' ? faChevronUp : faChevronDown} className="text-xs" style={{ color: 'var(--color-text-muted)' }} />
            </button>
            {openDropdown === 'help' && (
              <div className="mt-2 space-y-3 px-2">
                <div className="poker-tile p-3">
                  <h4 className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                    {t('profile.settings.helpRules')}
                  </h4>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                    {t('profile.settings.helpRulesText')}
                  </p>
                </div>
                <div className="poker-tile p-3">
                  <h4 className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                    {t('profile.settings.helpGroupPlay')}
                  </h4>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                    {t('profile.settings.helpGroupPlayText')}
                  </p>
                </div>
                <div className="poker-tile p-3">
                  <h4 className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                    {t('profile.settings.helpSupport')}
                  </h4>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                    {t('profile.settings.helpSupportText')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
