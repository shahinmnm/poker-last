export type TextDirection = 'ltr' | 'rtl'

export interface LanguageConfig {
  code: string
  label: string
  direction: TextDirection
}

const FALLBACK_LANGUAGE_METADATA: Record<string, Omit<LanguageConfig, 'code'>> = {
  en: { label: 'English', direction: 'ltr' },
  fa: { label: 'فارسی', direction: 'rtl' },
}

const LANGUAGE_STORAGE_KEY = 'pokerbot.preferredLanguage'

const rawSupportedLanguages =
  import.meta.env.VITE_SUPPORTED_LANGS ||
  Object.keys(FALLBACK_LANGUAGE_METADATA)
    .sort()
    .join(',')

function normalizeCode(code: string) {
  return code.trim().toLowerCase()
}

function envKeyFor(code: string, suffix: string) {
  return `VITE_LANG_${code.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_${suffix.toUpperCase()}`
}

function normalizeDirection(value?: string | null): TextDirection {
  return value?.toLowerCase() === 'rtl' ? 'rtl' : 'ltr'
}

function resolveLanguageConfig(code: string): LanguageConfig {
  const normalizedCode = normalizeCode(code)
  const envRecord = import.meta.env as unknown as Record<string, string | undefined>
  const label =
    envRecord[envKeyFor(normalizedCode, 'label')] ||
    FALLBACK_LANGUAGE_METADATA[normalizedCode]?.label ||
    normalizedCode
  const direction = normalizeDirection(
    envRecord[envKeyFor(normalizedCode, 'dir')] ||
      FALLBACK_LANGUAGE_METADATA[normalizedCode]?.direction,
  )

  return {
    code: normalizedCode,
    label,
    direction,
  }
}

const rawCodes = rawSupportedLanguages.split(',').map((value: string) => normalizeCode(value))
const supportedCodes = Array.from(new Set<string>(rawCodes)).filter((code) => code.length > 0)

export const supportedLanguages: LanguageConfig[] = supportedCodes.map((code) =>
  resolveLanguageConfig(code),
)

const fallbackCode = supportedLanguages.find((lang) => lang.code === 'en')?.code || supportedLanguages[0]?.code || 'en'

const preferredLanguage =
  (import.meta.env.VITE_DEFAULT_LANGUAGE && normalizeCode(import.meta.env.VITE_DEFAULT_LANGUAGE)) ||
  fallbackCode

export const defaultLanguage =
  supportedLanguages.find((lang) => lang.code === preferredLanguage)?.code ||
  fallbackCode

export const fallbackLanguage = fallbackCode
export const languageStorageKey = LANGUAGE_STORAGE_KEY
