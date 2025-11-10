import { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { useLocalization } from '../providers/LocalizationProvider'

export default function LanguageSelector() {
  const { language, supported, changeLanguage } = useLocalization()
  const { t } = useTranslation()

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    changeLanguage(event.target.value)
  }

  return (
    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
      <span className="hidden sm:inline">{t('settings.sections.language.title')}</span>
      <select
        value={language}
        onChange={handleChange}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        {supported.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {t(`languages.${lang.code}`, { defaultValue: lang.label })}
          </option>
        ))}
      </select>
    </label>
  )
}
