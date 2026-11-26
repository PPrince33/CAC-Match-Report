'use client'

import { Suspense, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import PlayerReportShell from '../../../components/player/PlayerReportShell.jsx'
import '../player-report.css'

// Read-only player report built from public processed data:
//   /player/<player_id>                     → every processed match the player appears in
//   /player/<player_id>?matches=<id>,<id>   → just those matches
// Client reports with the scout summary and player details use the
// project share link instead: /player/share/<token> (created in the tagger).
function PlayerPageInner() {
  const { id } = useParams()
  const matchParam = useSearchParams().get('matches')
  const matchIds = useMemo(() => (matchParam ? matchParam.split(',').map(s => s.trim()).filter(Boolean) : null), [matchParam])
  return <PlayerReportShell playerId={id} matchIds={matchIds} />
}

export default function PlayerPage() {
  return <Suspense fallback={null}><PlayerPageInner /></Suspense>
}
