import { useTranslation } from 'react-i18next'

import { useLocalization } from '../providers/LocalizationProvider'

export default function LanguageSelector() {
  const { language, supported, changeLanguage } = useLocalization()
  const { t } = useTranslation()

  const currentIndex = supported.findIndex((lang) => lang.code === language)
  const nextLanguage = supported[(currentIndex + 1) % supported.length]

  const handleToggle = () => {
    changeLanguage(nextLanguage.code)
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={t('settings.sections.language.title')}
      aria-label={t('settings.sections.language.title')}
      className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
    >
      <span role="img" aria-hidden="true">
        🌐
      </span>
      <span>{language.toUpperCase()}</span>
    </button>
  )
}
