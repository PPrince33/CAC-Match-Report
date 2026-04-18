'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, fetchSupabase } from '../../../lib/supabase.js'
import { RefreshCw, LogOut, Edit3, Plus } from 'lucide-react'

export default function AdminDashboardPage() {
  const router = useRouter()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.replace('/admin')
        return
      }
      setUser(currentUser)
      setAuthChecked(true)

      try {
        const data = await fetchSupabase('matches', {
          select: 'match_id,match_name,match_date,status,is_futsal,tournament_name,home_team_score,away_team_score,home_team:teams!matches_home_team_id_fkey(team_name),away_team:teams!matches_away_team_id_fkey(team_name)',
          order: 'match_date.desc'
        })
        setMatches(data || [])
      } catch (err) {
        console.error('Failed to fetch matches:', err)
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndFetch()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin')
  }

  const statusColor = (status) => {
    if (status === 'Done') return 'bg-[#06D6A0] text-black'
    if (status === 'Live') return 'bg-[#D90429] text-white'
    return 'bg-gray-200 text-black'
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#f8fafc] font-mono flex items-center justify-center">
        <div className="flex items-center gap-3 text-xl font-bold uppercase">
          <RefreshCw className="animate-spin" /> Verifying session...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-mono flex flex-col">
      {/* Header */}
      <header className="bg-black text-white p-6 border-b-4 border-black">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none">
              Admin Dashboard
            </h1>
            <p className="text-[#06D6A0] font-black uppercase tracking-[0.3em] text-xs mt-2">
              {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="border-2 border-white px-4 py-2 font-bold uppercase text-xs hover:bg-white hover:text-black transition-all"
            >
              Public Site
            </Link>
            <button
              onClick={handleLogout}
              className="border-2 border-[#D90429] px-4 py-2 font-bold uppercase text-xs text-[#D90429] hover:bg-[#D90429] hover:text-white transition-all flex items-center gap-2"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="border-b-4 border-black bg-[#FFD166] p-4">
        <div className="max-w-7xl mx-auto flex items-center gap-8">
          <div className="text-xs font-black uppercase">
            <span className="text-3xl font-black mr-2">{matches.length}</span>
            Total Matches
          </div>
          <div className="text-xs font-black uppercase">
            <span className="text-3xl font-black mr-2 text-[#0077B6]">
              {matches.filter(m => m.status === 'Done').length}
            </span>
            Completed
          </div>
          <div className="text-xs font-black uppercase">
            <span className="text-3xl font-black mr-2 text-[#D90429]">
              {matches.filter(m => m.status !== 'Done').length}
            </span>
            Pending
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="p-6 md:p-8 max-w-7xl mx-auto w-full flex-1">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black uppercase border-b-4 border-black pb-1">All Matches</h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-xl font-bold uppercase py-20 justify-center">
            <RefreshCw className="animate-spin" /> Loading matches...
          </div>
        ) : (
          <div className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
            {/* Table Header */}
            <div className="bg-black text-white grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-3 text-[10px] font-black uppercase tracking-widest">
              <span>Match</span>
              <span>Date</span>
              <span>Score</span>
              <span>Sport</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {matches.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-gray-400 font-black uppercase">No matches found.</p>
              </div>
            ) : (
              matches.map((m, idx) => (
                <div
                  key={m.match_id}
                  className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-4 items-center border-b border-gray-100 hover:bg-gray-50 transition-all ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                >
                  {/* Match Name */}
                  <div>
                    <p className="font-black uppercase text-sm leading-tight">
                      <span className="text-[#0077B6]">{m.home_team?.team_name}</span>
                      <span className="text-gray-400 mx-2">vs</span>
                      <span className="text-[#D90429]">{m.away_team?.team_name}</span>
                    </p>
                    {m.match_name && (
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">{m.match_name}</p>
                    )}
                    {m.tournament_name && (
                      <p className="text-[10px] text-gray-500 font-black uppercase mt-0.5">{m.tournament_name}</p>
                    )}
                  </div>

                  {/* Date */}
                  <div className="text-xs font-bold text-gray-500 whitespace-nowrap">
                    {m.match_date || '—'}
                  </div>

                  {/* Score */}
                  <div className="text-sm font-black whitespace-nowrap">
                    <span className="text-[#0077B6]">{m.home_team_score ?? '?'}</span>
                    <span className="text-gray-300 mx-1">-</span>
                    <span className="text-[#D90429]">{m.away_team_score ?? '?'}</span>
                  </div>

                  {/* Sport */}
                  <div>
                    <span className={`border border-black px-2 py-0.5 text-[9px] font-black uppercase ${m.is_futsal ? 'bg-[#06D6A0] text-black' : 'bg-[#0077B6] text-white'}`}>
                      {m.is_futsal ? 'Futsal' : 'Football'}
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    <span className={`border border-black px-2 py-0.5 text-[9px] font-black uppercase ${statusColor(m.status)}`}>
                      {m.status || 'Unknown'}
                    </span>
                  </div>

                  {/* Edit Button */}
                  <div>
                    <Link
                      href={`/admin/dashboard/match/${m.match_id}`}
                      className="flex items-center gap-1.5 border-2 border-black px-3 py-1.5 font-black uppercase text-[10px] bg-white hover:bg-[#FFD166] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none transition-all"
                    >
                      <Edit3 size={12} />
                      Edit
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <footer className="mt-auto p-6 border-t-4 border-black text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
        CAC Admin Panel
      </footer>
    </div>
  )
}
