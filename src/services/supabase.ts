import { createClient, SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://msg-oilfield.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.demo'

export function getStoredSupabaseConfig() {
  const url = localStorage.getItem('msg_supabase_url') || DEFAULT_SUPABASE_URL
  const key = localStorage.getItem('msg_supabase_anon_key') || DEFAULT_SUPABASE_ANON_KEY
  return { url, key }
}

export function saveSupabaseConfig(url: string, key: string) {
  localStorage.setItem('msg_supabase_url', url)
  localStorage.setItem('msg_supabase_anon_key', key)
  currentClient = createClient(url, key)
}

let currentClient: SupabaseClient = createClient(
  getStoredSupabaseConfig().url,
  getStoredSupabaseConfig().key
)

export function getSupabase(): SupabaseClient {
  return currentClient
}

export async function testSupabaseConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
  try {
    const testClient = createClient(url, key)
    const { error } = await testClient.from('items').select('id').limit(1)
    if (error && error.code !== 'PGRST116') {
      return { success: false, message: error.message }
    }
    return { success: true, message: 'Successfully connected to Supabase PostgreSQL!' }
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection failed' }
  }
}
