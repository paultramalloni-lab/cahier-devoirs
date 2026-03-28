import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bzruqthdxgnsgdbgatqy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cnVxdGhkeGduc2dkYmdhdHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTMwNzQsImV4cCI6MjA5MDI2OTA3NH0.Zl3HSh2QT1AyAJh-_xTIUc2IRs-jZRO-yvNE38RXoA8*'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)