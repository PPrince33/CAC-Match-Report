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
    <div className="min-h-screen bg-[#f8fafc] font-mono flex flex-col">
      <header className="bg-black text-white p-6 border-b-4 border-black">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none">
            CAC Admin
          </h1>
          <p className="text-[#06D6A0] font-black uppercase tracking-[0.3em] text-xs mt-2">
            Match Report Control Panel
          </p>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
            <h2 className="text-2xl font-black uppercase mb-2">Admin Login</h2>
            <p className="text-xs font-bold text-gray-400 uppercase mb-8">
              Authenticated access only
            </p>

            {error && (
              <div className="border-2 border-[#D90429] bg-[#D90429]/10 p-3 mb-6">
                <p className="text-xs font-black text-[#D90429] uppercase">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border-2 border-black p-3 font-bold text-sm focus:outline-none focus:border-[#0077B6] bg-white"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border-2 border-black p-3 font-bold text-sm focus:outline-none focus:border-[#0077B6] bg-white"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full border-2 border-black py-3 font-black uppercase text-sm bg-black text-white hover:bg-[#0077B6] hover:border-[#0077B6] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t-2 border-dashed border-gray-200">
              <a
                href="/"
                className="text-xs font-black uppercase text-gray-400 hover:text-black transition-all"
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
