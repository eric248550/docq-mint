'use client'

import { useEffect } from 'react'
import { initAuthListener } from '@/lib/firebase/auth'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAuthListener()
  }, [])

  return <>{children}</>
}

