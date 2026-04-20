import { NextResponse } from 'next/server'

const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'gemma2-9b-it', 'llama-3.1-8b-instant']

const isSkippableError = (status, errJson) => {
  const code = errJson?.error?.code || ''
  const msg = (errJson?.error?.message || '').toLowerCase()
  return status === 429 || status === 503 ||
    code === 'rate_limit_exceeded' || code === 'model_decommissioned' ||
    msg.includes('too large') || msg.includes('rate limit') || msg.includes('decommissioned')
}

async function callGemini(systemPrompt, messages) {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Gemini error:', res.status, JSON.stringify(err))
      return null
    }
    const data = await res.json()
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!reply) return null
    return { reply, tokens: data.usageMetadata?.totalTokenCount || 0, provider: 'gemini' }
  } catch (e) {
    console.error('Gemini fetch error:', e.message)
    return null
  }
}

async function callGroq(messages) {
  const key = process.env.GROQ_API_KEY
  if (!key) return null

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 512 }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        if (isSkippableError(res.status, errJson)) continue
        return null
      }
      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content
      if (!reply) return null
      return { reply, tokens: data.usage?.total_tokens || 0, provider: 'groq' }
    } catch (_) { continue }
  }
  return null
}

export async function POST(req) {
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
- PPDA: ${match.homeName} ${defHome.ppda ?? 'N/A'} | ${match.awayName} ${defAway.ppda ?? 'N/A'}
- Tackles (success%): ${match.homeName} ${defHome.totalTackles} (${defHome.tackleSuccess}%) | ${match.awayName} ${defAway.totalTackles} (${defAway.tackleSuccess}%)
- Interceptions: ${match.homeName} ${defHome.totalInterceptions} | ${match.awayName} ${defAway.totalInterceptions}
- Possession Wins: ${match.homeName} ${defHome.possessionWins} | ${match.awayName} ${defAway.possessionWins}
- Pressures: ${match.homeName} ${defHome.totalPressures} | ${match.awayName} ${defAway.totalPressures}
- Saves: ${match.homeName} ${defHome.totalSaves} | ${match.awayName} ${defAway.totalSaves}

PLAYER STATS (CAC Points — #1 is Man of the Match)
${allPlayers.map((p, i) =>
  `${i + 1}. #${p.jersey} ${p.name} (${p.teamName}) — ${p.total}pts [Goals:${p.goal/10}, Assists:${p.assist/6}, KeyPass:${p.keyPass/3}, ProgPass:${p.progressive}, SoT:${p.shotSoT/5}, OffTarget:${p.offTarget/3}, Dribbles:${p.dribble}, Recovery:${p.recovery/2}]`
).join('\n')}

GOAL EVENTS
${goalEvents.length > 0
  ? goalEvents.map(g => `- ${g.minute}' ${g.scorer} (${g.team})${g.assister ? ` assist:${g.assister}` : ''}`).join('\n')
  : '- None'}

PLAYER PASS STATS
${(playerPassStats || []).map(p =>
  `#${p.jersey} ${p.name} (${p.team}): acc:${p.accuracy}% ${p.successful}/${p.total}, backpasses:${p.backPasses}`
).join('\n')}

PER-PLAYER TOP ACTIONS
${(playerEventSummary || []).map(p => {
  const top = Object.entries(p.actions).sort((a,b) => b[1]-a[1]).slice(0, 5).map(([k,v]) => `${k}:${v}`).join(', ')
  return `#${p.jersey} ${p.name} (${p.team}): ${top}`
}).join('\n')}

TEAM EVENTS — ${match.homeName}: ${Object.entries(eventSummary?.home || {}).sort((a,b) => b[1]-a[1]).slice(0,15).map(([k,v]) => `${k}:${v}`).join(', ')}
TEAM EVENTS — ${match.awayName}: ${Object.entries(eventSummary?.away || {}).sort((a,b) => b[1]-a[1]).slice(0,15).map(([k,v]) => `${k}:${v}`).join(', ')}
`.trim()

  const systemPrompt = `You are a match data assistant for CAC. Answer ONLY from the match data below. If the answer isn't in the data, say: "I don't have that information in this match's data." Be concise and quote numbers directly.

MATCH DATA:
${contextBlock}`

  const groqMessages = [
    { role: 'system', content: systemPrompt },
    ...(messages || []),
  ]

  const result = await callGemini(systemPrompt, messages || []) || await callGroq(groqMessages)

  if (!result) {
    return NextResponse.json({ error: 'All providers are currently unavailable. Please try again in a few minutes.' }, { status: 429 })
  }

  return NextResponse.json({ reply: result.reply, tokens: result.tokens, provider: result.provider })
}
