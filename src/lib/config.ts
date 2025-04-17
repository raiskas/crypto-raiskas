// Configurações centralizadas para o Supabase

export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lccneuonbuzagjjtaipp.supabase.co',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjY25ldW9uYnV6YWdqanRhaXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDE4NzMsImV4cCI6MjA1OTc3Nzg3M30.zOXrOg2ywlqye1rEyH8PdaH8GBbAzKrygg63uASnH3A',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjY25ldW9uYnV6YWdqanRhaXBwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDIwMTg3MywiZXhwIjoyMDU5Nzc3ODczfQ.BlEB4LVdKmRsrl2y-9l0oCauEoTmOmEbbZtxLuradr0',
  // Configurações adicionais para ambiente de produção
  options: {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-application-name': 'crypto-raiskas'
      }
    }
  }
}; 