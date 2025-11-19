import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons'

import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'

export default function HelpPage() {
  const { t } = useTranslation()

  const howToPlaySteps = t('help.howToPlay.steps', {
    returnObjects: true,
  }) as string[]
  const faqItems = t('help.faq.items', {
    returnObjects: true,
  }) as Array<{ question: string; answer: string }>

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('help.title')}
        icon={<FontAwesomeIcon icon={faCircleQuestion} />}
      />

      <Card>
        <h2 className="text-section-title text-[color:var(--text-primary)]">{t('help.howToPlay.title')}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-body text-[color:var(--text-muted)]">
          {howToPlaySteps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </Card>

      <Card>
        <h2 className="text-section-title text-[color:var(--text-primary)]">{t('help.faq.title')}</h2>
        <div className="mt-3 space-y-3">
          {faqItems.map((item, index) => (
            <details
              key={index}
              className="group rounded-xl border border-[color:var(--surface-border)] p-4"
            >
              <summary className="cursor-pointer list-none font-semibold">
                <span className="text-body text-[color:var(--text-primary)] group-open:text-[color:var(--accent-start)]">
                  {item.question}
                </span>
              </summary>
              <p className="mt-2 text-body text-[color:var(--text-muted)]">{item.answer}</p>
            </details>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-section-title text-[color:var(--text-primary)]">{t('help.support.title')}</h2>
        <p className="mt-2 text-body text-[color:var(--text-muted)]">
          {t('help.support.description')}
        </p>
      </Card>
    </div>
  )
}
