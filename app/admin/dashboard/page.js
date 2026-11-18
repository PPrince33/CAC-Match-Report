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
    if (status === 'Done') return 'bg-[#6BDB58] text-black'
    if (status === 'Live') return 'bg-[#0B0D0B] text-white'
    return 'bg-[#D6DBD3] text-black'
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#FFFFFF] font-sans flex items-center justify-center">
        <div className="flex items-center gap-3 text-xl font-bold uppercase">
          <RefreshCw className="animate-spin" /> Verifying session...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white text-[#0B0D0B] px-6 md:px-8 py-6 border-b-2 border-[#D6DBD3]">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none">
              Admin Dashboard
            </h1>
            <p className="text-[#23801A] font-mono font-bold uppercase tracking-[0.2em] text-xs mt-2">
              {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full border-2 border-[#0B0D0B] px-4 py-2 font-mono font-bold uppercase text-xs hover:bg-[#0B0D0B] hover:text-white transition-all"
            >
              Public Site
            </Link>
            <button
              onClick={handleLogout}
              className="border-2 border-[#0B0D0B] rounded-full px-4 py-2 font-bold uppercase text-xs text-[#0B0D0B] hover:bg-[#0B0D0B] hover:text-white transition-all flex items-center gap-2"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="border-b-4 border-line bg-[#6BDB58] p-4">
        <div className="max-w-7xl mx-auto flex items-center gap-8">
          <div className="text-xs font-black uppercase">
            <span className="text-3xl font-black mr-2">{matches.length}</span>
            Total Matches
          </div>
          <div className="text-xs font-black uppercase">
            <span className="text-3xl font-black mr-2 text-[#23801A]">
              {matches.filter(m => m.status === 'Done').length}
            </span>
            Completed
          </div>
          <div className="text-xs font-black uppercase">
            <span className="text-3xl font-black mr-2 text-[#0B0D0B]">
              {matches.filter(m => m.status !== 'Done').length}
            </span>
            Pending
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="p-6 md:p-8 max-w-7xl mx-auto w-full flex-1">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black uppercase border-b-4 border-line pb-1">All Matches</h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-xl font-bold uppercase py-20 justify-center">
            <RefreshCw className="animate-spin" /> Loading matches...
          </div>
        ) : (
          <div className="rounded-[20px] border-2 border-line bg-white overflow-hidden">
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
                <p className="text-[#9AA397] font-black uppercase">No matches found.</p>
              </div>
            ) : (
              matches.map((m, idx) => (
                <div
                  key={m.match_id}
                  className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-4 items-center border-b border-[#D6DBD3] hover:bg-[#F0F2EE] transition-all ${idx % 2 === 0 ? '' : 'bg-[#F0F2EE]/50'}`}
                >
                  {/* Match Name */}
                  <div>
                    <p className="font-black uppercase text-sm leading-tight">
                      <span className="text-[#0077B6]">{m.home_team?.team_name}</span>
                      <span className="text-[#9AA397] mx-2">vs</span>
                      <span className="text-[#D90429]">{m.away_team?.team_name}</span>
                    </p>
                    {m.match_name && (
                      <p className="text-[10px] text-[#9AA397] font-bold uppercase mt-0.5">{m.match_name}</p>
                    )}
                    {m.tournament_name && (
                      <p className="text-[10px] text-[#5B6359] font-black uppercase mt-0.5">{m.tournament_name}</p>
                    )}
                  </div>

                  {/* Date */}
                  <div className="text-xs font-bold text-[#5B6359] whitespace-nowrap">
                    {m.match_date || '—'}
                  </div>

                  {/* Score */}
                  <div className="text-sm font-black whitespace-nowrap">
                    <span className="text-[#0077B6]">{m.home_team_score ?? '?'}</span>
                    <span className="text-[#9AA397] mx-1">-</span>
                    <span className="text-[#D90429]">{m.away_team_score ?? '?'}</span>
                  </div>

                  {/* Sport */}
                  <div>
                    <span className={`border border-line px-2 py-0.5 text-[9px] font-black uppercase ${m.is_futsal ? 'bg-[#6BDB58] text-black' : 'bg-[#0B0D0B] text-white'}`}>
                      {m.is_futsal ? 'Futsal' : 'Football'}
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    <span className={`border border-line px-2 py-0.5 text-[9px] font-black uppercase ${statusColor(m.status)}`}>
                      {m.status || 'Unknown'}
                    </span>
                  </div>

                  {/* Edit Button */}
                  <div>
                    <Link
                      href={`/admin/dashboard/match/${m.match_id}`}
                      className="flex items-center gap-1.5 border-2 border-line px-3 py-1.5 font-black uppercase text-[10px] bg-white hover:bg-[#6BDB58] transition-all"
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

      <footer className="mt-auto p-6 border-t-4 border-line text-center text-[10px] font-black uppercase tracking-[0.2em] text-[#9AA397]">
        CAC Admin Panel
      </footer>
    </div>
  )
}
