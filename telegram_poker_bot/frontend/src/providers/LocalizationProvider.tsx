import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react'

import i18n from '../i18n'
import {
  languageStorageKey,
  supportedLanguages,
  type LanguageConfig,
} from '../config/env'
import { useTelegram } from '../hooks/useTelegram'

interface LocalizationContextValue {
  language: string
  supported: LanguageConfig[]
  changeLanguage: (code: string) => void
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
  const { user, ready } = useTelegram()
  const telegramPrefApplied = useRef(false)

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
    if (!ready || telegramPrefApplied.current || !user?.language_code) {
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
