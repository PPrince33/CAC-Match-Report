import { NextResponse } from 'next/server'

export async function POST(req) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 500 })
  }

  const body = await req.json()
  const { messages, matchContext } = body

  if (!matchContext) {
    return NextResponse.json({ error: 'matchContext required' }, { status: 400 })
  }

  const { match, home, away, defHome, defAway, vertHome, vertAway, fieldTilt, allPlayers, goalEvents, eventSummary, playerEventSummary, playerPassStats } = matchContext

  const contextBlock = `
MATCH: ${match.homeName} ${match.homeScore} – ${match.awayScore} ${match.awayName}
Tournament: ${match.tournament} | Date: ${match.date} | Sport: ${match.sport}

POSSESSION & TEMPO
- Possession: ${home.possession}% (${match.homeName}) vs ${away.possession}% (${match.awayName})
- Verticality: ${match.homeName} ${vertHome.ratio ?? 'N/A'}% forward passes (${vertHome.label ?? ''}) | ${match.awayName} ${vertAway.ratio ?? 'N/A'}% (${vertAway.label ?? ''})
- Field Tilt: ${match.homeName} ${fieldTilt.homeTilt}% | ${match.awayName} ${fieldTilt.awayTilt}%

ATTACKING
- xG: ${match.homeName} ${home.xg} | ${match.awayName} ${away.xg}
- Shots (SoT): ${match.homeName} ${home.shots} (${home.sot}) | ${match.awayName} ${away.shots} (${away.sot})
- Shots Inside Box: ${match.homeName} ${home.boxShots} | ${match.awayName} ${away.boxShots}
- Key Passes: ${match.homeName} ${home.keyPasses} | ${match.awayName} ${away.keyPasses}
- Assists: ${match.homeName} ${home.assists} | ${match.awayName} ${away.assists}
- Pass Accuracy: ${match.homeName} ${home.passAcc}% (${home.passes} passes) | ${match.awayName} ${away.passAcc}% (${away.passes} passes)

DEFENSIVE & PRESSING
- PPDA (lower = more intense press): ${match.homeName} ${defHome.ppda ?? 'N/A'} | ${match.awayName} ${defAway.ppda ?? 'N/A'}
- Tackles (success%): ${match.homeName} ${defHome.totalTackles} (${defHome.tackleSuccess}%) | ${match.awayName} ${defAway.totalTackles} (${defAway.tackleSuccess}%)
- Interceptions: ${match.homeName} ${defHome.totalInterceptions} | ${match.awayName} ${defAway.totalInterceptions}
- Possession Wins: ${match.homeName} ${defHome.possessionWins} | ${match.awayName} ${defAway.possessionWins}
- Total Pressures: ${match.homeName} ${defHome.totalPressures} | ${match.awayName} ${defAway.totalPressures}
- Saves: ${match.homeName} ${defHome.totalSaves} | ${match.awayName} ${defAway.totalSaves}
- Ball Recoveries: ${match.homeName} ${defHome.ballRecoveries ?? 'N/A'} | ${match.awayName} ${defAway.ballRecoveries ?? 'N/A'}

PLAYER STATS (CAC Points Leaderboard — #1 is Man of the Match / Best Player)
${allPlayers.map((p, i) =>
  `${i + 1}. #${p.jersey} ${p.name} (${p.teamName}) — ${p.total} pts [Goals: ${p.goal/10}, Assists: ${p.assist/6}, Key Passes: ${p.keyPass/3}, Progressive passes: ${p.progressive}, Shots on target: ${p.shotSoT/5}, Shots off target: ${p.offTarget/3}, Dribbles: ${p.dribble}, Ball recoveries: ${p.recovery/2}, Blocks: ${p.block}pts]`
).join('\n')}

GOAL EVENTS
${goalEvents.length > 0
  ? goalEvents.map(g => `- ${g.minute}' — ${g.scorer} (${g.team})${g.assister ? ` assisted by ${g.assister}` : ''}`).join('\n')
  : '- No goals recorded with event data'}

PLAYER PASS ACCURACY (min 5 passes, sorted by accuracy)
${(playerPassStats || []).map(p =>
  `#${p.jersey} ${p.name} (${p.team}): ${p.accuracy}% (${p.successful}/${p.total} passes)`
).join('\n')}

PER-PLAYER ACTION COUNTS (top actions only)
${(playerEventSummary || []).map(p => {
  const top = Object.entries(p.actions).sort((a,b) => b[1]-a[1]).slice(0, 5).map(([k,v]) => `${k}:${v}`).join(', ')
  return `#${p.jersey} ${p.name} (${p.team}): ${top}`
}).join('\n')}

TEAM EVENT BREAKDOWN — ${match.homeName}: ${Object.entries(eventSummary?.home || {}).sort((a,b) => b[1]-a[1]).slice(0,15).map(([k,v]) => `${k}:${v}`).join(', ')}
TEAM EVENT BREAKDOWN — ${match.awayName}: ${Object.entries(eventSummary?.away || {}).sort((a,b) => b[1]-a[1]).slice(0,15).map(([k,v]) => `${k}:${v}`).join(', ')}
`.trim()

  const systemPrompt = `You are a match data assistant for CAC (Calico Analysis Company). You answer questions ONLY based on the match statistics and event data provided below. You have NO access to outside knowledge, historical data, or information about other matches.

Rules:
- Only use facts from the data block below.
- If a question cannot be answered from the data, say exactly: "I don't have that information in this match's data."
- Do not guess, infer from general football knowledge, or mention external facts.
- Keep answers concise and data-driven.
- When referencing numbers, quote them directly from the data.

MATCH DATA:
${contextBlock}`

  const groqMessages = [
    { role: 'system', content: systemPrompt },
    ...(messages || []),
  ]

  const models = [
    'llama-3.3-70b-versatile',
    'llama3-70b-8192',
    'gemma2-9b-it',
    'llama-3.1-8b-instant',
  ]

  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: groqMessages,
          temperature: 0.3,
          max_tokens: 512,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        let errJson
        try { errJson = JSON.parse(errText) } catch (_) {}
        const code = errJson?.error?.code || ''
        const msg = errJson?.error?.message || ''
        if (res.status === 429 || res.status === 503 || code === 'rate_limit_exceeded' || code === 'model_decommissioned' || msg.includes('too large') || msg.includes('Request too large')) {
          continue
        }
        return NextResponse.json({ error: errText }, { status: res.status })
      }

      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content || ''
      return NextResponse.json({ reply, model })
    } catch (_) {
      continue
    }
  }

  return NextResponse.json({ error: 'All models are currently rate-limited. Please try again in a few minutes.' }, { status: 429 })
}
