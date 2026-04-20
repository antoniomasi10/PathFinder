/**
 * Offline validation: checks which ATS board tokens are valid and counts
 * student-relevant roles. Does NOT touch the database.
 * Run: npx ts-node scripts/test-ats-tokens.ts
 */

const STUDENT_KEYWORDS = [
  'intern', 'internship', 'stage', 'stagiaire', 'tirocinio',
  'trainee', 'traineeship', 'graduate', 'apprenti', 'apprentice',
  'student', 'co-op', 'werkstudent', 'alternance', 'junior',
];

function isStudentRole(title: string): boolean {
  const t = title.toLowerCase();
  if (t.includes('internal')) return false;
  return STUDENT_KEYWORDS.some(kw => t.includes(kw));
}

const GREENHOUSE_BOARDS = [
  'cloudflare','databricks','stripe','airbnb','doordashusa','anthropic',
  'scaleai','coinbase','asana','okta','datadog','imc','pinterest','figma',
  'duolingo','robinhood','dropbox','waymo','nuro','lyft','brex','reddit',
  'cockroachlabs','instacart','elastic','wolt','adyen','celonis','hellofresh',
  'getyourguide','miro','mollie','personio','doctolib','glovoapp','contentful',
  'deliveryhero','klarna','trivago','bumble','monzo','sumup','zendesk',
];

const LEVER_BOARDS = [
  'spotify','anchorage','dnb','shieldai','weride','BestEgg','rigetti',
  'voleon','theathletic','aisafety','fehrandpeers','quincyinst','cognite',
  'solopulseco','revolut','n26','netflix','plaid','palantir','shopify',
  'kraken','benchling',
];

const ASHBY_BOARDS = [
  'openai','perplexity','cohere','replit','ramp','vanta','notion',
  'backmarket','alan','linear','supabase','cursor','posthog','vercel',
  'retool','deel','n8n','tome','elevenlabs','mistral',
];

async function testGreenhouse(token: string) {
  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${token}/jobs`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return { ok: false, status: res.status, total: 0, student: 0 };
    const data: any = await res.json();
    const jobs = data.jobs || [];
    const student = jobs.filter((j: any) => isStudentRole(j.title || '')).length;
    return { ok: true, status: 200, total: jobs.length, student };
  } catch (e: any) {
    return { ok: false, status: 0, total: 0, student: 0, err: e.message };
  }
}

async function testLever(token: string) {
  try {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${token}?limit=500`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return { ok: false, status: res.status, total: 0, student: 0 };
    const jobs: any = await res.json();
    const arr = Array.isArray(jobs) ? jobs : [];
    const student = arr.filter((j: any) => isStudentRole(j.text || '')).length;
    return { ok: true, status: 200, total: arr.length, student };
  } catch (e: any) {
    return { ok: false, status: 0, total: 0, student: 0, err: e.message };
  }
}

async function testAshby(token: string) {
  try {
    const res = await fetch(
      `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=true`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return { ok: false, status: res.status, total: 0, student: 0 };
    const data: any = await res.json();
    const jobs = data.jobs || [];
    const student = jobs.filter((j: any) => isStudentRole(j.title || '')).length;
    return { ok: true, status: 200, total: jobs.length, student };
  } catch (e: any) {
    return { ok: false, status: 0, total: 0, student: 0, err: e.message };
  }
}

async function run() {
  console.log('\n=== GREENHOUSE ===');
  let ghTotal = 0, ghStudent = 0, ghOk = 0, ghFail = 0;
  for (const t of GREENHOUSE_BOARDS) {
    const r = await testGreenhouse(t);
    const mark = r.ok ? '✅' : '❌';
    console.log(`${mark} ${t.padEnd(20)} total=${r.total} student=${r.student} ${r.ok ? '' : '(' + r.status + ')'}`);
    if (r.ok) { ghOk++; ghTotal += r.total; ghStudent += r.student; } else ghFail++;
  }
  console.log(`→ ${ghOk} valid, ${ghFail} failed | total=${ghTotal} student=${ghStudent}`);

  console.log('\n=== LEVER ===');
  let lvTotal = 0, lvStudent = 0, lvOk = 0, lvFail = 0;
  for (const t of LEVER_BOARDS) {
    const r = await testLever(t);
    const mark = r.ok ? '✅' : '❌';
    console.log(`${mark} ${t.padEnd(20)} total=${r.total} student=${r.student} ${r.ok ? '' : '(' + r.status + ')'}`);
    if (r.ok) { lvOk++; lvTotal += r.total; lvStudent += r.student; } else lvFail++;
  }
  console.log(`→ ${lvOk} valid, ${lvFail} failed | total=${lvTotal} student=${lvStudent}`);

  console.log('\n=== ASHBY ===');
  let asTotal = 0, asStudent = 0, asOk = 0, asFail = 0;
  for (const t of ASHBY_BOARDS) {
    const r = await testAshby(t);
    const mark = r.ok ? '✅' : '❌';
    console.log(`${mark} ${t.padEnd(20)} total=${r.total} student=${r.student} ${r.ok ? '' : '(' + r.status + ')'}`);
    if (r.ok) { asOk++; asTotal += r.total; asStudent += r.student; } else asFail++;
  }
  console.log(`→ ${asOk} valid, ${asFail} failed | total=${asTotal} student=${asStudent}`);

  console.log(`\n=== SUMMARY ===`);
  console.log(`Student roles total: ${ghStudent + lvStudent + asStudent}`);
}

run().catch(err => { console.error(err); process.exit(1); });
