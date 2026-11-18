'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase.js'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError(authError.message)
      } else {
        router.push('/admin/dashboard')
      }
    } catch (err) {
      setError('Unexpected error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] font-sans flex flex-col">
      <header className="bg-white text-[#0B0D0B] px-6 md:px-8 py-6 border-b-2 border-[#D6DBD3]">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none">
            CAC Admin
          </h1>
          <p className="text-[#23801A] font-mono font-bold uppercase tracking-[0.2em] text-xs mt-2">
            Match Report Control Panel
          </p>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="rounded-[22px] p-8 bg-[#F0F2EE]">
            <h2 className="text-2xl font-black uppercase mb-2">Admin Login</h2>
            <p className="text-xs font-bold text-[#9AA397] uppercase mb-8">
              Authenticated access only
            </p>

            {error && (
              <div className="border-2 border-[#0B0D0B] bg-[#F0F2EE] rounded-xl p-3 mb-6">
                <p className="text-xs font-black text-[#0B0D0B] uppercase">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#5B6359] mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border-2 border-line p-3 font-bold text-sm focus:outline-none focus:border-[#6BDB58] bg-white"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#5B6359] mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border-2 border-line p-3 font-bold text-sm focus:outline-none focus:border-[#6BDB58] bg-white"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full border-2 border-[#0B0D0B] py-3 font-mono font-bold uppercase tracking-wider text-sm bg-[#0B0D0B] text-white hover:bg-[#6BDB58] hover:text-[#0B0D0B] hover:border-[#6BDB58] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t-2 border-dashed border-[#D6DBD3]">
              <a
                href="/"
                className="text-xs font-black uppercase text-[#9AA397] hover:text-black transition-all"
              >
                ← Back to Match Reports
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
