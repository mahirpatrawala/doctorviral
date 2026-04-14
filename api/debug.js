import supabase from './_lib/supabase.js'

export default async function handler(req, res) {
  const { data, error } = await supabase.from('practices').select('id, name').limit(3)
  res.json({
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING',
    },
    data,
    error: error?.message || null,
  })
}
