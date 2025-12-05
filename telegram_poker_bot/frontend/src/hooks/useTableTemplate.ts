import { useCallback, useEffect, useState } from 'react'
import { getTableTemplate } from '@/services/tables'
import type { TableTemplateInfo } from '@/types'
import { useTelegram } from './useTelegram'

export function useTableTemplate(templateId?: string | null) {
  const { initData } = useTelegram()
  const [template, setTemplate] = useState<TableTemplateInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (id?: string | null) => {
      if (!id) {
        setTemplate(null)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const data = await getTableTemplate(id, initData)
        setTemplate(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load template')
      } finally {
        setLoading(false)
      }
    },
    [initData],
  )

  useEffect(() => {
    void load(templateId)
  }, [templateId, load])

  return { template, loading, error, reload: load }
}
