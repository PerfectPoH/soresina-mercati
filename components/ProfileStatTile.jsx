'use client'

import { motion } from 'framer-motion'

/**
 * Tile statistica per il profilo: numero grande in Fraunces, label sotto.
 * Hover lift sottile con micro-tilt per dare "vita" senza distrarre.
 *
 * @param {{
 *   label: string,
 *   value: number | string,
 *   accent?: 'amber' | 'green' | 'stone',
 *   hint?: string,
 *   index?: number,
 * }} props
 */
export default function ProfileStatTile({ label, value, accent = 'stone', hint, index = 0 }) {
  const accentClasses = {
    amber: 'text-amber-700',
    green: 'text-green-700',
    stone: 'text-stone-900',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className="bg-white border border-stone-200 rounded-2xl p-5 transition-shadow hover:shadow-sm"
    >
      <div className={`text-3xl font-semibold tabular-nums ${accentClasses[accent]}`} style={{ fontFamily: 'var(--font-display)' }}>
        {value}
      </div>
      <div className="text-xs text-stone-500 mt-1.5 uppercase tracking-wider font-medium">
        {label}
      </div>
      {hint && <div className="text-[11px] text-stone-400 mt-1">{hint}</div>}
    </motion.div>
  )
}
