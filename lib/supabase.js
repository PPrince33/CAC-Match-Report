import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://pxhbxewnijavotdwiueo.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4aGJ4ZXduaWphdm90ZHdpdWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjIwODIsImV4cCI6MjA4OTkzODA4Mn0.UD55F-XT43KYbZpKRiwuD70eSNLpJvAQT5n-V5bYL00'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export { SUPABASE_URL, SUPABASE_ANON_KEY }

export const fetchSupabase = async (table, queryParams) => {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`)
  Object.entries(queryParams).forEach(([key, value]) => url.searchParams.append(key, value))
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    }
  })
  if (!res.ok) throw new Error(`Supabase Error: ${res.status}`)
  return res.json()
}
