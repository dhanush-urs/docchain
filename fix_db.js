const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jzrzobdyvxmhlrjmmayk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6cnpvYmR5dnhtaGxyam1tYXlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTM4MzI2NCwiZXhwIjoyMTA0OTU5MjY0fQ.O8jd0P53ehLDr64XIQeIn44ShI_TDz9RSoQfm7wnWVs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: docs, error } = await supabase.from('documents').select('*');
  if (error) {
    console.error('Error fetching docs:', error);
    return;
  }
  
  let fixedCount = 0;
  for (const doc of docs) {
    // Check if version exists
    const { data: versions } = await supabase.from('document_versions').select('*').eq('document_id', doc.id);
    if (!versions || versions.length === 0) {
      console.log(`Fixing doc ${doc.original_filename}...`);
      const { error: insertErr } = await supabase.from('document_versions').insert({
        document_id: doc.id,
        version_number: doc.current_version || 1,
        storage_path: doc.storage_path,
        size_bytes: doc.size_bytes,
        sha256: doc.sha256,
        uploaded_by: doc.uploaded_by,
        change_summary: 'Initial upload'
      });
      if (insertErr) console.error('Error inserting version:', insertErr);
      else fixedCount++;
    }
  }
  console.log(`Fixed ${fixedCount} documents.`);
}

main();
