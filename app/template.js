'use client'

import { motion, MotionConfig } from 'framer-motion'

// template.js (Next.js App Router) wrappa ogni route e si rimonta ad ogni
// navigazione — differenza chiave rispetto a layout.js, che persiste.
// Questo e' esattamente cio' che serve per animare l'ingresso di ogni pagina.
//
// Accessibilita': MotionConfig reducedMotion="user" fa si' che framer-motion
// rispetti prefers-reduced-motion dell'utente (skippa le transform e
// usa transizioni istantanee). Il CSS globale gia' azzera le transition
// CSS, ma framer-motion usa il proprio motore JS e ha bisogno di questo
// setting esplicito.
//
// Animazione: breve fade + slide su Y di 8px. Leggero, elegante, non
// fastidioso su navigazioni frequenti.
export default function PageTemplate({ children }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.28,
          ease: [0.22, 0.61, 0.36, 1], // ease-out morbido
        }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  )
}
