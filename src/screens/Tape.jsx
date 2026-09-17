import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { listEntriesForUser } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { MEASUREMENTS, metaFor, unitFor, labelFor } from '../lib/measurements'
import Icon from '../components/Icon'

export default function Tape() {
  const { user } = useAuth()
  const [entries, setEntries] = useState(null)
  const [metric, setMetric] = useState('weight')

  useEffect(() => {
    listEntriesForUser(user.id)
      .then(setEntries)
      .catch((err) => {
        console.error('Could not load your history:', err)
        setEntries([])
      })
  }, [user.id])

  // Which measurements this person has actually recorded — so the switcher
  // only offers charts that exist.
  const tracked = useMemo(() => {
    if (!entries) return []
    return MEASUREMENTS.filter((m) => entries.some((e) => e[m.key] != null))
  }, [entries])

  // Keep the selected metric on something real.
  useEffect(() => {
    if (tracked.length && !tracked.some((m) => m.key === metric)) {
      setMetric(tracked[0].key)
    }
  }, [tracked, metric])

  const data = useMemo(() => {
    if (!entries) return []
    return entries
      .filter((e) => e[metric] != null)
      .map((e) => ({ date: e.date, value: Number(e[metric]), label: fmtDate(e.date) }))
  }, [entries, metric])

  return (
    <div className="page">
      <h1 className="page-title">The tape</h1>

      {entries === null ? (
        <>
          <div className="skeleton sk-card" style={{ height: 150 }} />
          <div className="skeleton sk-card" style={{ height: 260 }} />
        </>
      ) : tracked.length === 0 ? (
        <div className="empty">
          <span className="empty-emoji">📈</span>
          <div className="empty-title">No measurements yet</div>
          <p>Log a couple of entries and your lines start here.</p>
        </div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 18 }}>
            {tracked.map((m) => (
              <button
                key={m.key}
                className={`chip ${metric === m.key ? 'active' : ''}`}
                onClick={() => setMetric(m.key)}
              >
                <Icon name={m.key} size={17} className="measure-icon" />
                {m.label}
              </button>
            ))}
          </div>

          <MetricChart data={data} metric={metric} color={user.color || '#c9f24d'} />
        </>
      )}
    </div>
  )
}

function MetricChart({ data, metric, color }) {
  if (data.length === 0) {
    return (
      <div className="card">
        <div className="empty" style={{ padding: '24px 8px' }}>
          <p>No {labelFor(metric).toLowerCase()} logged yet.</p>
        </div>
      </div>
    )
  }

  const latest = data[data.length - 1].value
  const diff = Math.round((latest - data[0].value) * 10) / 10
  const meta = metaFor(metric)
  const isProgress = meta?.lowerIsProgress ? diff < 0 : diff > 0
  const cls = diff === 0 ? 'flat' : isProgress ? 'good' : 'bad'
  const gradId = `fill-${metric}`

  return (
    <div className="card">
      {/* Headline: where you are now, and the move since the first entry. */}
      <p className="section-label">Current {labelFor(metric).toLowerCase()}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <span className="stat stat-xl">
          {latest}
          <span className="stat-unit">{unitFor(metric)}</span>
        </span>
        {data.length > 1 && (
          <span className={`delta-value ${cls}`} style={{ marginLeft: 0 }}>
            {diff === 0 ? 'no change' : `${diff > 0 ? '+' : ''}${diff} ${unitFor(metric)}`}
          </span>
        )}
      </div>
      <p className="muted" style={{ fontSize: 13, margin: '8px 0 20px' }}>
        {data.length === 1
          ? 'First entry — log again to see a trend.'
          : `${data.length} entries since ${fmtDate(data[0].date)}`}
      </p>

      <div style={{ width: '100%', height: 230, marginLeft: -8 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -14 }}>
            <defs>
              {/* The one gradient in the app. */}
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#24272e" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#878d99', fontSize: 12 }}
              stroke="#24272e"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: '#878d99', fontSize: 12 }}
              stroke="#24272e"
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              width={44}
            />
            <Tooltip
              cursor={{ stroke: '#3a3f48', strokeWidth: 1 }}
              contentStyle={{
                background: '#1a1c21',
                border: '1px solid #24272e',
                borderRadius: 10,
                color: '#f4f5f7',
                fontSize: 13,
              }}
              labelStyle={{ color: '#878d99', marginBottom: 2 }}
              formatter={(v) => [`${v} ${unitFor(metric)}`, labelFor(metric)]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradId})`}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5.5, fill: color, stroke: '#0a0b0d', strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function fmtDate(iso) {
  const [, m, d] = iso.split('-')
  return `${m}/${d}`
}
