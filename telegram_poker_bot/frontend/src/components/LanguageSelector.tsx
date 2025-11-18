import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLanguage } from '@fortawesome/free-solid-svg-icons'

import { useLocalization } from '../providers/LocalizationProvider'

interface LanguageSelectorProps {
  variant?: 'pill' | 'icon'
}

export default function LanguageSelector({ variant = 'pill' }: LanguageSelectorProps) {
  const { language, supported, changeLanguage } = useLocalization()
  const { t } = useTranslation()

  const currentIndex = supported.findIndex((lang) => lang.code === language)
  const nextLanguage = supported[(currentIndex + 1) % supported.length]

  const handleToggle = () => {
    changeLanguage(nextLanguage.code)
  }

  const baseClasses =
    'transition-transform duration-150 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]'

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={t('settings.sections.language.title')}
        aria-label={t('settings.sections.language.title')}
        className={`${baseClasses} glass-icon-circle text-[13px] font-semibold text-[color:var(--color-text)]`}
      >
        {language.toUpperCase()}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={t('settings.sections.language.title')}
      aria-label={t('settings.sections.language.title')}
      className={`${baseClasses} glass-pill flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[color:var(--color-text)] shadow-[0_10px_24px_rgba(0,0,0,0.35)]`}
    >
      <FontAwesomeIcon icon={faLanguage} />
      <span>{language.toUpperCase()}</span>
    </button>
  )
}
