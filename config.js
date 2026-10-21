// Supabase → Project Settings → API. The anon key is safe in the browser
// because Row Level Security (see schema.sql) limits each user to their own rows.
window.CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY"
};
