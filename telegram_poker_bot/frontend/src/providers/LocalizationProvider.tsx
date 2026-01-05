import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react'

import i18n from '../i18n'
import {
  languageStorageKey,
  supportedLanguages,
  type LanguageConfig,
} from '../config/env'
import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'

interface LocalizationContextValue {
  language: string
  supported: LanguageConfig[]
  changeLanguage: (code: string) => void
}

interface UserPreferencesResponse {
  language?: string
  preferred_currency?: string
}

const LocalizationContext = createContext<LocalizationContextValue>({
  language: i18n.language,
  supported: supportedLanguages,
  changeLanguage: () => {},
})

function applyDocumentDirection(config: LanguageConfig) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.lang = config.code
  document.documentElement.dir = config.direction
  if (document.body) {
    document.body.dir = config.direction
  }
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<string>(i18n.language)
  const { user, ready, initData } = useTelegram()
  const telegramPrefApplied = useRef(false)
  const serverPrefApplied = useRef(false)

  useEffect(() => {
    const currentConfig =
      supportedLanguages.find((item) => item.code === language) || supportedLanguages[0]
    if (currentConfig) {
      applyDocumentDirection(currentConfig)
    }
  }, [language])

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setLanguage(lng)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(languageStorageKey, lng)
      }
    }

    i18n.on('languageChanged', handleLanguageChanged)
    setLanguage(i18n.language)

    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [])

  useEffect(() => {
    if (!ready || serverPrefApplied.current || !initData) {
      return
    }
    let isActive = true
    const fetchPreferences = async () => {
      try {
        const data = await apiFetch<UserPreferencesResponse>('/users/me/preferences', { initData })
        const preferred = data?.language?.toLowerCase()
        if (!isActive || !preferred) return
        const match = supportedLanguages.find((item) => preferred.startsWith(item.code))
        if (match && match.code !== i18n.language) {
          serverPrefApplied.current = true
          i18n.changeLanguage(match.code)
          return
        }
        if (match) {
          serverPrefApplied.current = true
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[LocalizationProvider] Failed to load user preferences', error)
        }
      }
    }
    fetchPreferences()
    return () => {
      isActive = false
    }
  }, [initData, ready])

  useEffect(() => {
    if (!ready || serverPrefApplied.current || telegramPrefApplied.current || !user?.language_code) {
      return
    }

    const normalized = user.language_code.toLowerCase()
    const match = supportedLanguages.find((item) => normalized.startsWith(item.code))
    if (match && match.code !== i18n.language) {
      telegramPrefApplied.current = true
      i18n.changeLanguage(match.code)
    } else if (match) {
      telegramPrefApplied.current = true
    }
  }, [ready, user])

  const changeLanguage = (code: string) => {
    if (!supportedLanguages.some((item) => item.code === code)) {
      return
    }
    i18n.changeLanguage(code)
    if (initData) {
      void apiFetch<UserPreferencesResponse>('/users/me/preferences', {
        method: 'POST',
        initData,
        body: { language: code },
      })
    }
  }

  const value = useMemo(
    () => ({
      language,
      supported: supportedLanguages,
      changeLanguage,
    }),
    [language],
  )

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>
}

export function useLocalization() {
  return useContext(LocalizationContext)
}
