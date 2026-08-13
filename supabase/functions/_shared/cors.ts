// Standard Supabase Edge Function CORS headers -- needed once the function
// is called directly from the browser (the manual sync button) rather than
// only from curl/CLI/cron, which don't enforce CORS.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
