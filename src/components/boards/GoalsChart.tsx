'use client'

/**
 * GoalsChart — published vs target per board×language, as grouped bars.
 * react-chartjs-2 wrapper; replaces the COE's Chart.js usage.
 */

import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js'
import type { PublishingMetrics } from '@/lib/boards/publishing'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const round1 = (n: number) => Math.round(n * 10) / 10

export function GoalsChart({ metrics }: { metrics: PublishingMetrics }) {
  const rows = metrics.boards.flatMap((b) =>
    b.langs.map((l) => ({ label: `${b.short} · ${l.lang}`, done: l.done, target: round1(l.target) })),
  )

  const data = {
    labels: rows.map((r) => r.label),
    datasets: [
      { label: 'Published', data: rows.map((r) => r.done), backgroundColor: '#0E4777', borderRadius: 4 },
      { label: 'Target', data: rows.map((r) => r.target), backgroundColor: '#cbd5e1', borderRadius: 4 },
    ],
  }

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  }

  return (
    <div className="h-64">
      <Bar data={data} options={options} />
    </div>
  )
}
