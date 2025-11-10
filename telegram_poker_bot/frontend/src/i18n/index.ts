import i18n, { type Resource } from 'i18next'
import { initReactI18next } from 'react-i18next'

import enTranslations from '../locales/en/translation.json'
import faTranslations from '../locales/fa/translation.json'
import {
  defaultLanguage,
  fallbackLanguage,
  languageStorageKey,
  supportedLanguages,
} from '../config/env'

const resources: Resource = {
  en: { translation: enTranslations },
  fa: { translation: faTranslations },
}

const supportedLngs = supportedLanguages
  .map((lang) => lang.code)
  .filter((code) => Boolean(resources[code]))

const storageAvailable = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
const storedLanguage = storageAvailable ? window.localStorage.getItem(languageStorageKey) : null

const initialLanguage =
  storedLanguage && supportedLngs.includes(storedLanguage) ? storedLanguage : defaultLanguage

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: initialLanguage,
    fallbackLng: supportedLngs.includes(fallbackLanguage) ? fallbackLanguage : supportedLngs[0],
    resources,
    interpolation: {
      escapeValue: false,
    },
    supportedLngs,
    defaultNS: 'translation',
    returnNull: false,
  })
}

export default i18n
