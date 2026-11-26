'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase.js'
import PlayerReportShell from '../../../../components/player/PlayerReportShell.jsx'
import '../../player-report.css'

// Public, read-only report for a Player Project: /player/share/<share_token>.
// The token is checked by the get_shared_player_project() database function,
// which also returns the scout summary only once it has been approved.
export default function SharedPlayerReportPage() {
  const { token } = useParams()
  const [state, setState] = useState(null)

  useEffect(() => {
    supabase.rpc('get_shared_player_project', { token }).then(({ data, error }) => {
      if (error || !data) setState({ error: 'This report link is not valid. Ask CAC for a new one.' })
      else setState({ summary: data.scout_summary, playerId: data.player_id, matchIds: data.match_ids || [], profile: data.profile })
    })
  }, [token])

  if (!state) return null
  return <PlayerReportShell playerId={state.playerId} matchIds={state.matchIds} summary={state.summary} profile={state.profile} error={state.error} />
}
