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

  const passByJersey = Object.fromEntries((playerPassStats || []).map(p => [`${p.team}-${p.jersey}`, p]))
  const actionsByJersey = Object.fromEntries((playerEventSummary || []).map(p => [`${p.team}-${p.jersey}`, p]))

  const playerLines = allPlayers.map((p, i) => {
    const key = `${p.teamName}-${p.jersey}`
    const pass = passByJersey[key]
    const act = actionsByJersey[key]
    const passStr = pass ? ` pass:${pass.accuracy}%(${pass.successful}/${pass.total}) back:${pass.backPasses}` : ''
    const actStr = act ? ' ' + Object.entries(act.actions).sort((a,b) => b[1]-a[1]).slice(0, 4).map(([k,v]) => `${k}:${v}`).join(',') : ''
    return `${i + 1}.#${p.jersey} ${p.name}(${p.teamName}) ${p.total}pts G:${p.goal/10} A:${p.assist/6} KP:${p.keyPass/3} PP:${p.progressive} SoT:${p.shotSoT/5} Off:${p.offTarget/3} Dr:${p.dribble} Rec:${p.recovery/2}${passStr}${actStr}`
  }).join('\n')

  const contextBlock = `
MATCH: ${match.homeName} ${match.homeScore}–${match.awayScore} ${match.awayName} | ${match.tournament} | ${match.date} | ${match.sport}

TEAM STATS (Home | Away)
Poss: ${home.possession}% | ${away.possession}%
Vert: ${vertHome.ratio ?? 'N/A'}% | ${vertAway.ratio ?? 'N/A'}%
FieldTilt: ${fieldTilt.homeTilt}% | ${fieldTilt.awayTilt}%
xG: ${home.xg} | ${away.xg}
Shots(SoT): ${home.shots}(${home.sot}) | ${away.shots}(${away.sot})
BoxShots: ${home.boxShots} | ${away.boxShots}
KeyPasses: ${home.keyPasses} | ${away.keyPasses}
Assists: ${home.assists} | ${away.assists}
PassAcc: ${home.passAcc}%(${home.passes}) | ${away.passAcc}%(${away.passes})
PPDA: ${defHome.ppda ?? 'N/A'} | ${defAway.ppda ?? 'N/A'}
Tackles: ${defHome.totalTackles}(${defHome.tackleSuccess}%) | ${defAway.totalTackles}(${defAway.tackleSuccess}%)
Interceptions: ${defHome.totalInterceptions} | ${defAway.totalInterceptions}
PossWins: ${defHome.possessionWins} | ${defAway.possessionWins}
Pressures: ${defHome.totalPressures} | ${defAway.totalPressures}
Saves: ${defHome.totalSaves} | ${defAway.totalSaves}

GOALS
${goalEvents.length > 0 ? goalEvents.map(g => `${g.minute}' ${g.scorer}(${g.team})${g.assister ? ` a:${g.assister}` : ''}`).join(' | ') : 'None'}

PLAYERS (ranked by CAC pts — #1 = MoM)
${playerLines}

TEAM EVENTS ${match.homeName}: ${Object.entries(eventSummary?.home || {}).sort((a,b) => b[1]-a[1]).slice(0,8).map(([k,v]) => `${k}:${v}`).join(', ')}
TEAM EVENTS ${match.awayName}: ${Object.entries(eventSummary?.away || {}).sort((a,b) => b[1]-a[1]).slice(0,8).map(([k,v]) => `${k}:${v}`).join(', ')}
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
