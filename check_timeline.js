const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jzrzobdyvxmhlrjmmayk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6cnpvYmR5dnhtaGxyam1tYXlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTM4MzI2NCwiZXhwIjoyMTA0OTU5MjY0fQ.O8jd0P53ehLDr64XIQeIn44ShI_TDz9RSoQfm7wnWVs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: events, error } = await supabase.from('timeline_events').select('*').order('created_at', { ascending: false }).limit(10);
  console.log(JSON.stringify(events, null, 2));
}

main();
