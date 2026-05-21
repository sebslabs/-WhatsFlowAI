const supabaseUrl = 'https://gnajmcduhagforoophav.supabase.co';
const supabaseKey = 'sb_publishable_AXKykSh__PL132LzMT_djQ_AxI_ri2y';

async function runDiag() {
  console.log("Connecting to: " + supabaseUrl);
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { 'apikey': supabaseKey }
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response sample:", text.slice(0, 500));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
runDiag();
