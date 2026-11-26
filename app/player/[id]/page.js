'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase.js'
import PlayerReportShell from '../../../components/player/PlayerReportShell.jsx'
import '../player-report.css'

// /player/<player_id>                     → every processed match the player appears in
// /player/<player_id>?matches=<id>,<id>   → just those matches
// /player/<player_id>?project=<id>        → the matches of a Player Project (sign-in needed;
//                                            clients use /player/share/<token> instead)
function PlayerPageInner() {
  const { id } = useParams()
  const params = useSearchParams()
  const projectId = params.get('project')
  const matchParam = params.get('matches')
  const [state, setState] = useState(null)

  useEffect(() => {
    let alive = true
    const run = async () => {
      if (!projectId) {
        const ids = matchParam ? matchParam.split(',').map(s => s.trim()).filter(Boolean) : null
        return { matchIds: ids, project: null }
      }
      const { data: proj, error } = await supabase.from('player_projects')
        .select('project_id, player_id, share_token, scout_summary, summary_approved, player_project_matches(match_id)')
        .eq('project_id', projectId).maybeSingle()
      if (error || !proj) return { error: 'This project is private. Sign in at /admin first, or open the share link you were sent.' }
      if (proj.player_id !== id) return { error: 'This project belongs to a different player.' }
      return { matchIds: (proj.player_project_matches || []).map(m => m.match_id), project: proj }
    }
    run().then(s => { if (alive) setState(s) })
    return () => { alive = false }
  }, [id, projectId, matchParam])

  if (!state) return null
  return <PlayerReportShell playerId={id} matchIds={state.matchIds} project={state.project} error={state.error} />
}

export default function PlayerPage() {
  return <Suspense fallback={null}><PlayerPageInner /></Suspense>
}
