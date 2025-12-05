import { useEffect, useMemo, useState } from 'react'
import DynamicPokerTable from '@/components/table/DynamicPokerTable'
import {
  getTableTemplates,
  createTableTemplate,
  updateTableTemplate,
  deleteTableTemplate,
} from '@/services/tables'
import type { TableTemplateInfo, TemplateUISchema } from '@/types'
import { useTelegram } from '@/hooks/useTelegram'

export default function AdminTableTemplates() {
  const { initData } = useTelegram()
  const [templates, setTemplates] = useState<TableTemplateInfo[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [tableType, setTableType] = useState('CASH_GAME')
  const [configText, setConfigText] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const selectedTemplate = useMemo(
    () => templates.find((t) => String(t.id) === selectedId) || null,
    [templates, selectedId],
  )

  const uiSchema = useMemo<TemplateUISchema | undefined>(() => {
    try {
      const parsed = JSON.parse(configText || '{}')
      return parsed?.ui_schema as TemplateUISchema
    } catch (err) {
      return undefined
    }
  }, [configText])

  const backend = useMemo(() => {
    try {
      const parsed = JSON.parse(configText || '{}')
      return parsed?.backend ?? {}
    } catch (err) {
      return {}
    }
  }, [configText])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const response = await getTableTemplates()
        setTemplates(response.templates || [])
        if (!selectedId && response.templates?.length) {
          const first = response.templates[0]
          setSelectedId(String(first.id))
          setName(first.name || '')
          setTableType(first.table_type || 'CASH_GAME')
          setConfigText(JSON.stringify(first.config_json, null, 2))
        }
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Failed to load templates')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [selectedId])

  useEffect(() => {
    if (!selectedTemplate) return
    setName(selectedTemplate.name || '')
    setTableType(selectedTemplate.table_type || 'CASH_GAME')
    setConfigText(JSON.stringify(selectedTemplate.config_json, null, 2))
  }, [selectedTemplate])

  const handleSave = async () => {
    setStatus(null)
    setLoading(true)
    try {
      const payload = {
        name,
        table_type: tableType,
        config_json: JSON.parse(configText || '{}'),
      }
      if (selectedId) {
        const updated = await updateTableTemplate(selectedId, payload, initData)
        setTemplates((prev) => prev.map((t) => (String(t.id) === selectedId ? updated : t)))
        setStatus('Template updated')
      } else {
        const created = await createTableTemplate(payload, initData)
        setTemplates((prev) => [created, ...prev])
        setSelectedId(String(created.id))
        setStatus('Template created')
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      await deleteTableTemplate(selectedId, initData)
      setTemplates((prev) => prev.filter((t) => String(t.id) !== selectedId))
      setSelectedId(null)
      setConfigText('')
      setName('')
      setStatus('Template deleted')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      <h2>Table Templates</h2>
      {status && <div style={{ color: 'var(--accent-color, #0b3d2e)' }}>{status}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
        <div>
          <button onClick={() => setSelectedId(null)} style={{ marginBottom: 8 }}>
            + New Template
          </button>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 8, maxHeight: 420, overflow: 'auto' }}>
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => setSelectedId(String(tpl.id))}
                style={{
                  padding: '8px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: String(tpl.id) === selectedId ? '#e8f5ee' : 'transparent',
                }}
              >
                <div style={{ fontWeight: 700 }}>{tpl.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{tpl.table_type}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Table Type</span>
            <select value={tableType} onChange={(e) => setTableType(e.target.value)}>
              <option value="CASH_GAME">Cash Game</option>
              <option value="TOURNAMENT">Tournament</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Config JSON</span>
            <textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              rows={14}
              style={{ fontFamily: 'monospace', minHeight: 240 }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={loading}>
              {selectedId ? 'Save Changes' : 'Create Template'}
            </button>
            {selectedId && (
              <button onClick={handleDelete} disabled={loading} style={{ color: '#b00020' }}>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
      <div style={{ padding: 12, background: '#f6faf7', borderRadius: 12 }}>
        <h3>Live Preview</h3>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <DynamicPokerTable template={uiSchema} />
          <div>
            <div>Backend summary</div>
            <pre style={{ fontSize: 12, background: '#fff', padding: 12, borderRadius: 8, maxWidth: 380 }}>
              {JSON.stringify(backend, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
