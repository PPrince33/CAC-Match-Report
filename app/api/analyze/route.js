import { NextResponse } from 'next/server'

const PROVIDERS = [
  { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: () => process.env.GEMINI_API_KEY, model: 'gemini-1.5-flash' },
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
  const { match, home, away, homeStats, awayStats, defHome, defAway, vertHome, vertAway, fieldTilt, topPlayers } = body

  const prompt = `You are a professional football/futsal data analyst. Write a concise, insightful match analysis report (4–5 paragraphs) based on the following statistics. Be specific, reference numbers, and highlight key tactical observations.

MATCH: ${match.homeName} ${match.homeScore} – ${match.awayScore} ${match.awayName}
Tournament: ${match.tournament} | Date: ${match.date} | Sport: ${match.sport}

POSSESSION & TEMPO
- Possession: ${home.possession}% (${match.homeName}) vs ${away.possession}% (${match.awayName})
- Verticality: ${match.homeName} ${vertHome.ratio}% forward passes (${vertHome.label}) | ${match.awayName} ${vertAway.ratio}% (${vertAway.label})
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

TOP PERFORMERS (CAC Player Points)
${topPlayers.slice(0, 5).map((p, i) => `${i + 1}. #${p.jersey} ${p.name} (${p.teamName}) — ${p.total} pts`).join('\n')}

Write the analysis in clear paragraphs covering: (1) match overview & result, (2) attacking performance & chances created, (3) defensive organisation & pressing, (4) key players & conclusion. Do not use bullet points — write in flowing analyst prose.`

  for (const provider of PROVIDERS) {
    const key = provider.key()
    if (!key) continue
    try {
      const res = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 1024 }),
      })

      if (!res.ok) {
        const errText = await res.text()
        let errJson
        try { errJson = JSON.parse(errText) } catch (_) {}
        if (isRateLimitError(res.status, errJson)) continue
        return NextResponse.json({ error: errText }, { status: res.status })
      }

      const data = await res.json()
      const analysis = data.choices?.[0]?.message?.content || ''
      return NextResponse.json({ analysis })
    } catch (_) {
      continue
    }
  }

  return NextResponse.json({ error: 'All providers are currently unavailable. Please try again in a few minutes.' }, { status: 429 })
}
