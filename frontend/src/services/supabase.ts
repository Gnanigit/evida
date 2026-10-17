import { createClient } from '@supabase/supabase-js'
import { config } from '../config'

// Browser client using the publishable key. supabase-js persists the session
// in localStorage and refreshes the access token automatically.
export const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey)
