import { useTranslation } from 'react-i18next'

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
      <header>
        <h1 className="text-2xl font-semibold">{t('help.title')}</h1>
      </header>

      <section id="how-to-play" className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('help.howToPlay.title')}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-600 dark:text-gray-300">
          {howToPlaySteps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </section>

      <section id="faq" className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('help.faq.title')}</h2>
        <div className="mt-3 space-y-3">
          {faqItems.map((item, index) => (
            <details
              key={index}
              className="group rounded-xl border border-slate-200 p-4 dark:border-gray-700"
            >
              <summary className="cursor-pointer list-none font-semibold">
                <span className="text-sm text-gray-800 dark:text-gray-100 group-open:text-blue-600 dark:group-open:text-blue-300">
                  {item.question}
                </span>
              </summary>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="support" className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('help.support.title')}</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {t('help.support.description')}
        </p>
      </section>
    </div>
  )
}
