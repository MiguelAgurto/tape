import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { MEASUREMENTS, unitFor, labelFor } from '../lib/measurements'

export default function Tape() {
  const { user } = useAuth()
  const [entries, setEntries] = useState(null)
  const [metric, setMetric] = useState('weight')

  useEffect(() => {
    supabase
      .from('entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .then(({ data }) => setEntries(data ?? []))
  }, [user.id])

  // Only points where this metric was recorded.
  const data = useMemo(() => {
    if (!entries) return []
    return entries
      .filter((e) => e[metric] != null)
      .map((e) => ({ date: e.date, value: Number(e[metric]), label: fmtDate(e.date) }))
  }, [entries, metric])

  return (
    <div className="page">
      <h1 className="page-title">The Tape</h1>

      <div className="row" style={{ marginBottom: 16 }}>
        {MEASUREMENTS.map((m) => (
          <button
            key={m.key}
            className={`chip ${metric === m.key ? 'active' : ''}`}
            onClick={() => setMetric(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="card">
        {entries === null ? (
          <p className="muted">Loading…</p>
        ) : data.length === 0 ? (
          <p className="muted">No {labelFor(metric).toLowerCase()} logged yet.</p>
        ) : (
          <>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="#2b303b" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#9aa3b2', fontSize: 11 }} stroke="#2b303b" />
                  <YAxis
                    tick={{ fill: '#9aa3b2', fontSize: 11 }}
                    stroke="#2b303b"
                    domain={['auto', 'auto']}
                    width={44}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#181b22',
                      border: '1px solid #2b303b',
                      borderRadius: 10,
                      color: '#e7eaf0',
                    }}
                    formatter={(v) => [`${v}${unitFor(metric)}`, labelFor(metric)]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={user.color || '#4f8cff'}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: user.color || '#4f8cff' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <TrendSummary data={data} metric={metric} />
          </>
        )}
      </div>
    </div>
  )
}

function TrendSummary({ data, metric }) {
  if (data.length < 2) return null
  const first = data[0].value
  const last = data[data.length - 1].value
  const diff = Math.round((last - first) * 10) / 10
  const meta = MEASUREMENTS.find((m) => m.key === metric)
  const isProgress = meta?.lowerIsProgress ? diff < 0 : diff > 0
  const cls = diff === 0 ? '' : isProgress ? 'down' : 'up'
  const sign = diff > 0 ? '+' : ''
  return (
    <p style={{ marginBottom: 0 }}>
      <span className="muted">Overall: </span>
      <span className={`delta ${cls}`}>
        {diff === 0 ? 'no change' : `${sign}${diff}${unitFor(metric)}`}
      </span>
      <span className="muted"> over {data.length} entries</span>
    </p>
  )
}

function fmtDate(iso) {
  const [, m, d] = iso.split('-')
  return `${m}/${d}`
}
