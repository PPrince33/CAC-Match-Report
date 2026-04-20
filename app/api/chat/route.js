import { NextResponse } from 'next/server'

const PROVIDERS = [
  { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: () => process.env.GEMINI_API_KEY, model: 'gemini-1.5-flash' },
  { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: () => process.env.GEMINI_API_KEY, model: 'gemini-1.5-flash-8b' },
  { url: 'https://api.groq.com/openai/v1/chat/completions', key: () => process.env.GROQ_API_KEY, model: 'llama-3.3-70b-versatile' },
  { url: 'https://api.groq.com/openai/v1/chat/completions', key: () => process.env.GROQ_API_KEY, model: 'llama3-70b-8192' },
  { url: 'https://api.groq.com/openai/v1/chat/completions', key: () => process.env.GROQ_API_KEY, model: 'gemma2-9b-it' },
  { url: 'https://api.groq.com/openai/v1/chat/completions', key: () => process.env.GROQ_API_KEY, model: 'llama-3.1-8b-instant' },
]

const isRateLimitError = (status, errJson) => {
  const code = errJson?.error?.code || ''
  const msg = errJson?.error?.message || ''
  return status === 429 || status === 503 ||
    code === 'rate_limit_exceeded' || code === 'model_decommissioned' ||
    msg.includes('too large') || msg.includes('Request too large') ||
    msg.includes('decommissioned')
}

export async function POST(req) {
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'No API keys configured' }, { status: 500 })
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

PLAYER PASS STATS (min 5 passes, sorted by accuracy)
${(playerPassStats || []).map(p =>
  `#${p.jersey} ${p.name} (${p.team}): accuracy ${p.accuracy}% (${p.successful}/${p.total}), back passes: ${p.backPasses}`
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

  const errors = []
  for (const provider of PROVIDERS) {
    const key = provider.key()
    if (!key) continue
    try {
      const res = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: provider.model, messages: groqMessages, temperature: 0.3, max_tokens: 512 }),
      })

      if (!res.ok) {
        const errText = await res.text()
        let errJson
        try { errJson = JSON.parse(errText) } catch (_) {}
        const summary = `${provider.model}: [${res.status}] ${errJson?.error?.message || errText}`
        console.error('Provider failed:', summary)
        errors.push(summary)
        if (isRateLimitError(res.status, errJson)) continue
        return NextResponse.json({ error: errText }, { status: res.status })
      }

      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content || ''
      return NextResponse.json({ reply })
    } catch (e) {
      errors.push(`${provider.model}: ${e.message}`)
      continue
    }
  }

  return NextResponse.json({ error: `All providers failed: ${errors.join(' | ')}` }, { status: 429 })
}
