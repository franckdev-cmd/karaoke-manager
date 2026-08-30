'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function FinishSinglersSetup({ venueId }: { venueId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const finish = async () => {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('venues').update({ onboarding_done: true }).eq('id', venueId)
    router.push('/manager')
  }

  return (
    <button
      onClick={finish}
      disabled={loading}
      style={{
        marginTop: 24, width: '100%', padding: '13px 18px', borderRadius: 14, border: 'none',
        background: 'var(--accent-gradient)', color: '#fff', fontWeight: 700, fontSize: 14.5,
        cursor: loading ? 'default' : 'pointer', boxShadow: '0 8px 20px rgba(124,58,237,.25)'
      }}
    >
      {loading ? 'Un instant...' : "C'est affiché, direction le manager →"}
    </button>
  )
}
