(function() {
  // ── Per-team PIN hashes (SHA-256). PINs distributed privately to each manager. ──
  const TEAM_PIN_HASHES = {
  "The Mixon Administration": "8a722f6cba6727dd73a08611b03a9a47e9894a94f5852592cc3dea1e51cb1db9",
  "The Benchwarmers": "bed814f027a26675181a41d666c1742178d5cd066905c685aaf919fb273398ed",
  "Windy City Waterboys": "66e5bd3165e62d49eb12382bf03057f852ac52ef854d5922d1b98ac8ae8af3a1",
  "Lets Cook": "2699b6d8684cd0e2dbb2a8f5302723bfdd61ccefbfe0e7ad422b82c90c9afced",
  "Show Me Your TDs": "d17cf2ce13a313bc5be429edc3902d6dc43578a07b498ef814172bb18c87d9a2",
  "Drunkin Pollacks": "eb9b92388c66726e0102b90f7c06f197e58e6b4e1d51122792d52186d5fc51f7",
  "The Nixon Administration": "f534be7d26ceaa0665e27c89d9f14d0f7be7e9ef36eddac5a6e0bcf936b882eb",
  "I've Fallen and I Can't Get Up": "cda7fd35486cb10dc02cb22ca915ca123ac4bce13828a3a7061ed8002a03bff8",
  "Benches Don't Score Points I Do": "bcee80bb2f3a52ecee3070dd9c16299c4d40957d9048cd7520d00231da1a3cd5",
  "There's a YOU Sheriff in Town": "e3fe8244b7408ab65631a0dd420dc72921d93717de439326519d176c6a2fa420",
  "Quarter Chubb": "e1a03a84a98af8b50b84edce66c4c7ba2d05478c2cd54418335641d378024762",
  "Half Chubb": "8fbba95ec4b04aa149695d13fdb38e27fe1878b643ee83a3ab604723d3d96a94"
  };

  const MAX_PLAYERS = 16;          // max non-TBD keepers
  const MAX_VALUE   = 200;         // max total keeper value ($)
  const FB_DB_URL   = "https://msuffl-default-rtdb.firebaseio.com";

  let unlockedTeam = null;         // team whose form is currently unlocked

  async function sha256(msg) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function posClass(pos){ return String(pos||'').replace(/[^A-Za-z]/g,'').toUpperCase(); }

  // Pull the freshest league data from Firebase so lock/submission status is current,
  // then merge manager submissions from the public keeper_submissions node.
  async function fetchLatest() {
    try {
      const r = await fetch(`${FB_DB_URL}/league_data/leagueData.json?t=${Date.now()}`);
      if (r.ok) {
        const raw = await r.json();
        if (raw) Object.assign(LEAGUE_DATA, typeof raw === 'string' ? JSON.parse(raw) : raw);
      }
    } catch(e) { /* offline / not configured — fall back to in-memory data */ }
    LEAGUE_DATA.keepers2026 = LEAGUE_DATA.keepers2026 || {};
    LEAGUE_DATA.keeperLocks = LEAGUE_DATA.keeperLocks || {};
    if (window.mergeKeeperSubmissions) await window.mergeKeeperSubmissions();
  }

  // COMMISSIONER-ONLY: mirror the full updated blob to Firebase (authenticated write)
  // so every live viewer + the budget-summary page see the change immediately.
  function pushToFirebase() {
    if (!window.fbSet) return;
    window.fbSet('league_data/leagueData', JSON.stringify(LEAGUE_DATA));
    window.fbSet('league_data/_version', Date.now());
  }

  // MANAGER: write only this team's submission to the public-writable per-team node.
  // The database rules make this create-only (an existing submission can't be tampered
  // with) and keep the main league blob locked to the commissioner.
  // Returns { ok, reason } — see fbPublicSet.
  async function pushKeeperSubmission(team) {
    if (!window.fbPublicSet) return { ok: false, reason: 'not-configured' };
    const res = await window.fbPublicSet(`keeper_submissions/${window.fbTeamKey(team)}`, {
      team: team,
      picks: LEAGUE_DATA.keepers2026[team] || [],
      budget: (LEAGUE_DATA.budgets && LEAGUE_DATA.budgets[team]) || null,
      locked: true,
      ts: Date.now()
    });
    if (res.ok) await window.fbPublicSet('league_data/_version', Date.now());
    return res;
  }

  // ── Draft-day bridges (commissioner) ──────────────────────────────────────
  function normName(n){ return (n||'').toLowerCase().replace(/[^a-z0-9]/g,''); }

  // The roster "menu" a team keeps from: the preserved full roster if non-keepers
  // have already been released, otherwise the live roster.
  function rosterMenu(team){
    return (LEAGUE_DATA.rostersFull && LEAGUE_DATA.rostersFull[team])
        || (LEAGUE_DATA.rosters && LEAGUE_DATA.rosters[team]) || [];
  }

  // Look up an NFL position for a drafted rookie from the live-draft player pool.
  function lookupPos(name){
    const pool = window.__ldPlayerPool || [];
    const hit = pool.find(p => normName(p.name) === normName(name));
    return hit ? String(hit.pos || '').replace(/\d+$/,'') : '';
  }

  // Resolve a rookie-draft "team" label to a real roster team name.
  function resolveTeam(label){
    const teams = LEAGUE_DATA.teams || [];
    if (teams.includes(label)) return label;
    const managers = LEAGUE_DATA.managers || {};
    // manager name -> team
    for (const [mgr, tm] of Object.entries(managers)) { if (mgr === label) return tm; }
    // token overlap against team + manager names (handles "Adam/Matt" -> "Lets Cook")
    const toks = s => new Set(String(s).toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 3));
    const want = toks(label);
    let best = null;
    for (const [mgr, tm] of Object.entries(managers)) {
      const cand = new Set([...toks(mgr), ...toks(tm)]);
      if ([...want].some(t => cand.has(t))) { if (best && best !== tm) return null; best = tm; }
    }
    return best;
  }

  function recomputeBudget(team){
    LEAGUE_DATA.budgets = LEAGUE_DATA.budgets || {};
    const b = LEAGUE_DATA.budgets[team] = LEAGUE_DATA.budgets[team] || {};
    const roster = LEAGUE_DATA.rosters[team] || [];
    const totalKept = roster.reduce((s,r) => s + (parseInt(r.val2026) || 0), 0);
    b.budget = '200';
    b.totalKept = String(totalKept);
    b.playerCount = String(roster.filter(r => r.val2026 !== 'TBD').length);
    b.remaining = String(200 - totalKept);
    b.inSeasonFaab = String(200 - totalKept + 25);
  }

  // BRIDGE 1 — add each drafted rookie to its team's roster at $1 (a roster spot).
  async function promoteRookies() {
    await fetchLatest();
    const drafts = LEAGUE_DATA.drafts || {};
    const years = Object.keys(drafts).filter(y => /^\d{4}$/.test(y)).sort();
    const year = years[years.length - 1];
    if (!year) { alert('No rookie draft data found.'); return; }
    const picks = drafts[year] || [];
    // A pick is "not yet drafted" if its player field is still a placeholder like
    // "Round 1, Pick 1" or "Round 2, Pick 1 (13)" — match both forms.
    const placeholder = /^\s*round\s*\d+\s*,\s*pick\s*\d+\s*(\(\s*\d+\s*\))?\s*$/i;
    const added = [], skipped = [], unmatched = [];
    LEAGUE_DATA.rosters = LEAGUE_DATA.rosters || {};
    picks.forEach(p => {
      const name = (p.player || '').trim();
      if (!name || placeholder.test(name)) return;            // pick not yet drafted
      const team = resolveTeam(p.team);
      if (!team) { unmatched.push(`${name} (pick owner "${p.team}")`); return; }
      const roster = LEAGUE_DATA.rosters[team] = LEAGUE_DATA.rosters[team] || [];
      if (roster.some(r => normName(r.player) === normName(name))) { skipped.push(`${name} → ${team}`); return; }
      roster.push({ player: name, pos: lookupPos(name), rookieDeal: 'R', val2025: '0', val2026: '1' });
      added.push(`${name} → ${team}`);
    });
    if (!added.length) {
      alert(`No new rookies to add for ${year}.\n\n` +
        (skipped.length ? `Already on rosters: ${skipped.length}\n` : '') +
        (unmatched.length ? `Couldn't match team for:\n• ${unmatched.join('\n• ')}\n\nFix these in the Rookie Draft page, then re-run.` :
         'Make sure rookie names are entered on the Rookie Draft page first.'));
      return;
    }
    const msg = `Add ${added.length} rookie(s) at $1 to rosters for ${year}:\n\n• ${added.join('\n• ')}` +
      (skipped.length ? `\n\nSkipped (already rostered): ${skipped.length}` : '') +
      (unmatched.length ? `\n\n⚠ Couldn't match team for ${unmatched.length} pick(s):\n• ${unmatched.join('\n• ')}\n(These were NOT added — fix on the Rookie Draft page.)` : '') +
      `\n\nApply now?`;
    if (!confirm(msg)) return;
    Object.keys(LEAGUE_DATA.rosters).forEach(recomputeBudget);
    if (window.commSave) await window.commSave.saveData('LEAGUE_DATA', LEAGUE_DATA, `Commissioner: promote ${added.length} ${year} rookies to rosters at $1`);
    pushToFirebase();
    if (typeof buildKeepers === 'function') { try { buildKeepers(); } catch(e){} }
    renderPortal();
    alert(`✓ Added ${added.length} rookie(s) at $1. They now appear as keeper options for their teams.`);
  }

  // BRIDGE 2 — reduce each roster to ONLY the team's locked keepers, so the auction's
  // available pool becomes exactly the remaining (un-kept) players. Full rosters are
  // preserved in rostersFull so reopened teams still see their whole roster to pick from.
  async function releaseNonKeepers() {
    await fetchLatest();
    const locks = LEAGUE_DATA.keeperLocks || {};
    const teams = LEAGUE_DATA.teams || [];
    const notLocked = teams.filter(t => !locks[t]);
    if (notLocked.length && !confirm(`${notLocked.length} team(s) have NOT locked keepers yet:\n• ${notLocked.join('\n• ')}\n\nReleasing now will leave them with their full current roster. Continue anyway?`)) return;
    if (!confirm('Build auction rosters now? Every player a team did NOT keep is released into the auction pool. Kept players (incl. rookies at $1) stay off the board. Restricted FAs go into the pool flagged RFA with their rights team. You can undo with "Restore full rosters".')) return;

    if (!LEAGUE_DATA.rostersFull) LEAGUE_DATA.rostersFull = JSON.parse(JSON.stringify(LEAGUE_DATA.rosters || {}));
    const full = LEAGUE_DATA.rostersFull;
    LEAGUE_DATA.keepers2026 = LEAGUE_DATA.keepers2026 || {};
    teams.forEach(team => {
      const kept = LEAGUE_DATA.keepers2026[team];
      if (!kept) return; // never submitted — leave roster as-is
      const menu = full[team] || [];
      // Kept players (numeric value) — excluded from the auction pool.
      const keptRows = kept.filter(k => String(k.value) !== 'TBD').map(k => {
        const src = menu.find(r => normName(r.player) === normName(k.player)) || {};
        return { player: k.player, pos: src.pos || lookupPos(k.player) || '', rookieDeal: src.rookieDeal || 'N', val2025: src.val2025 || '0', val2026: String(k.value) };
      });
      // Restricted FAs (TBD) — preserved on the rights-holder's roster so they appear
      // in the auction pool flagged RFA with this team as the rights holder.
      const taken = new Set(keptRows.map(r => normName(r.player)));
      const rfaRows = menu.filter(r => String(r.val2026) === 'TBD' && !taken.has(normName(r.player)))
        .map(r => ({ player: r.player, pos: r.pos || '', rookieDeal: r.rookieDeal || 'Restricted FA', val2025: r.val2025 || '0', val2026: 'TBD' }));
      LEAGUE_DATA.rosters[team] = keptRows.concat(rfaRows);
    });
    Object.keys(LEAGUE_DATA.rosters).forEach(recomputeBudget);
    if (window.commSave) await window.commSave.saveData('LEAGUE_DATA', LEAGUE_DATA, 'Commissioner: release non-keepers — build auction rosters');
    pushToFirebase();
    if (typeof buildKeepers === 'function') { try { buildKeepers(); } catch(e){} }
    if (typeof buildRosters === 'function') { try { buildRosters(); } catch(e){} }
    renderPortal();
    alert('✓ Auction rosters built. The Live Draft pool now shows un-kept players plus Restricted FAs (flagged RFA with their rights team). Kept players are off the board.');
  }

  async function restoreFullRosters() {
    await fetchLatest();
    if (!LEAGUE_DATA.rostersFull) { alert('Nothing to restore — full rosters were never replaced.'); return; }
    if (!confirm('Restore every team\'s full pre-keeper roster? This undoes "Release non-keepers".')) return;
    LEAGUE_DATA.rosters = JSON.parse(JSON.stringify(LEAGUE_DATA.rostersFull));
    delete LEAGUE_DATA.rostersFull;
    Object.keys(LEAGUE_DATA.rosters).forEach(recomputeBudget);
    if (window.commSave) await window.commSave.saveData('LEAGUE_DATA', LEAGUE_DATA, 'Commissioner: restore full rosters (undo release)');
    pushToFirebase();
    if (typeof buildKeepers === 'function') { try { buildKeepers(); } catch(e){} }
    if (typeof buildRosters === 'function') { try { buildRosters(); } catch(e){} }
    renderPortal();
    alert('✓ Full rosters restored.');
  }

  // Wipe ALL live data from Firebase so the site falls back to the data baked into the
  // deployed file. Deletes the whole league_data node (not just leagueData — a leftover
  // _version would keep partial data alive) plus the auction board, then reloads.
  async function resetDatabase() {
    if (!confirm('⚠️ RESET LIVE DATABASE?\n\nThis erases ALL live data — keeper submissions, rookie draft picks, roster edits, and the auction board — and reloads the site using the data in the deployed file.\n\nThis cannot be undone. Continue?')) return;
    if (!confirm('Are you absolutely sure? Every team\'s in-progress data in the live database will be permanently erased.')) return;
    try {
      if (window.fbSet) {
        await window.fbSet('league_data', null);   // PUT null deletes the node
        await window.fbSet('live_draft/picks', null);
        await window.fbSet('keeper_submissions', null);
      }
      alert('✓ Live database cleared. Reloading with the deployed data…');
      location.reload();
    } catch (e) {
      alert('Reset failed: ' + (e && e.message ? e.message : e));
    }
  }

  // Commit the entire current dataset to GitHub (bakes it into the deployed index.html).
  // Requires a GitHub token in this session. Pulls the latest live data first so the
  // commit captures team submissions made on other devices, not just this tab's memory.
  async function saveAllToGitHub() {
    if (!window.commSave) { alert('Save engine not available.'); return; }
    const hasToken = window.commMode && window.commMode.getToken && window.commMode.getToken();
    if (!hasToken) {
      alert('No GitHub token in this session.\n\nTo save permanently: click the 🔒 icon to log out, log back in with your password, and enter your GitHub token when prompted — then click "Save everything to GitHub" again.');
      return;
    }
    if (!confirm('Save ALL current data to GitHub? This bakes the live state (rosters, keepers, rookie draft, trades) into the deployed site and rebuilds it in ~30s.')) return;
    await fetchLatest(); // capture the freshest live state before committing
    const ok = await window.commSave.saveData('LEAGUE_DATA', LEAGUE_DATA, 'Commissioner: full save (all data) to site');
    if (ok) alert('✓ Saved to GitHub. The site rebuilds in ~30 seconds with this data baked in — it will now survive a database reset.');
    // commSave shows its own error toast on failure
  }

  // ── Totals / validation for the current checklist ──
  function recalc() {
    const rows = document.querySelectorAll('#kp-roster .kp-row');
    let count = 0, value = 0;
    rows.forEach(row => {
      const cb = row.querySelector('input[type=checkbox]');
      row.classList.toggle('kept', cb.checked);
      if (cb.checked && row.dataset.tbd !== '1') { count++; value += parseInt(row.dataset.val) || 0; }
    });
    const cntEl = document.getElementById('kp-count'), valEl = document.getElementById('kp-value');
    const overC = count > MAX_PLAYERS, overV = value > MAX_VALUE;
    if (cntEl){ cntEl.textContent = count + ' / ' + MAX_PLAYERS; cntEl.className = 'num ' + (overC?'over':'ok'); }
    if (valEl){ valEl.textContent = '$' + value + ' / $' + MAX_VALUE; valEl.className = 'num ' + (overV?'over':'ok'); }
    const btn = document.getElementById('kp-submit');
    const err = document.getElementById('kp-form-err');
    if (btn) btn.disabled = overC || overV || count === 0;
    if (err) err.textContent = overC ? `Too many players — max ${MAX_PLAYERS} (TBD players don't count).`
                            : overV ? `Over budget — max $${MAX_VALUE} in keeper value.`
                            : count === 0 ? 'Select at least one player to keep.' : '';
  }

  // ── Submit (locked on submit) ──
  async function doSubmit(team) {
    const btn = document.getElementById('kp-submit');
    btn.disabled = true; btn.textContent = 'Checking…';
    await fetchLatest();
    if (LEAGUE_DATA.keeperWindowLocked) { renderPortal(); return; }
    if (LEAGUE_DATA.keeperLocks[team])  { renderPortal(); return; }

    const picks = [], rows = document.querySelectorAll('#kp-roster .kp-row');
    let count = 0, value = 0;
    rows.forEach(row => {
      const cb = row.querySelector('input[type=checkbox]');
      if (!cb.checked) return;
      const tbd = row.dataset.tbd === '1';
      picks.push({ player: row.dataset.player, value: tbd ? 'TBD' : row.dataset.val });
      if (!tbd) { count++; value += parseInt(row.dataset.val) || 0; }
    });
    if (count > MAX_PLAYERS || value > MAX_VALUE || picks.length === 0) { recalc(); btn.textContent = '🔒 Submit & Lock Keepers'; return; }

    if (!confirm(`Submit ${picks.length} keeper(s) for ${team}?\n\n${count} counted player(s), $${value} total value.\n\nOnce submitted your keepers are LOCKED — contact the commissioner to make changes.`)) {
      btn.disabled = false; btn.textContent = '🔒 Submit & Lock Keepers'; return;
    }

    LEAGUE_DATA.keepers2026[team] = picks;
    LEAGUE_DATA.keeperLocks[team] = true;
    // Keep the budget-summary page accurate for this team
    LEAGUE_DATA.budgets = LEAGUE_DATA.budgets || {};
    const b = LEAGUE_DATA.budgets[team] = LEAGUE_DATA.budgets[team] || {};
    b.budget = '200'; b.totalKept = String(value); b.playerCount = String(count);
    b.remaining = String(MAX_VALUE - value); b.inSeasonFaab = String(MAX_VALUE - value + 25);

    // Managers write only their own team's submission node — never the league blob.
    const res = await pushKeeperSubmission(team);
    if (!res.ok) {
      delete LEAGUE_DATA.keeperLocks[team];
      const messages = {
        'denied': 'The league database rejected this submission. If your team already submitted once, ask the commissioner to reopen your team. Otherwise the database rules may not match the site version.',
        'file-protocol': 'You are viewing the site as a local file (file://) — live submissions only work on the deployed site (msuffl.com) or a local web server.',
        'not-configured': 'The league database is not configured on this copy of the site.',
        'network': 'Could not reach the league database — check your connection and try again.'
      };
      const err = document.getElementById('kp-form-err');
      if (err) { err.textContent = messages[res.reason] || messages['network']; err.style.display = 'block'; }
      btn.disabled = false; btn.textContent = '🔒 Submit & Lock Keepers';
      return;
    }
    if (typeof buildKeepers === 'function') { try { buildKeepers(); } catch(e){} }
    renderPortal();
  }

  // ── Render the team's checklist ──
  function renderForm(team) {
    const roster = rosterMenu(team);
    const prior = (LEAGUE_DATA.keepers2026 && LEAGUE_DATA.keepers2026[team]) || [];
    const existing = new Set(prior.map(k => k.player));
    // No prior submission → start with EVERY player checked; managers uncheck who they release.
    // (A reopened team still sees their previous picks.)
    const checkAll = prior.length === 0;
    // Restricted FAs (TBD value) are NOT keepers — they go to the auction as RFAs (you hold rights).
    const selectable = roster.filter(p => String(p.val2026) !== 'TBD');
    const rfas       = roster.filter(p => String(p.val2026) === 'TBD');
    const rowsHtml = selectable.map((p, i) => {
      const val = parseInt(p.val2026) || 0;
      const checked = (checkAll || existing.has(p.player)) ? 'checked' : '';
      return `<label class="kp-row ${checked?'kept':''}" data-i="${i}" data-tbd="0" data-val="${val}" data-player="${esc(p.player)}">
        <input type="checkbox" ${checked}>
        <span class="kp-pos ${posClass(p.pos)}">${esc(p.pos)}</span>
        <span class="kp-name">${esc(p.player)}<span class="sub">${esc(p.rookieDeal && p.rookieDeal!=='N' ? p.rookieDeal : '')}</span></span>
        <span class="kp-val">$${val}</span>
      </label>`;
    }).join('');
    const rfaHtml = rfas.length ? `
        <div class="kp-intro" style="margin:1rem 0 .4rem"><strong>Restricted Free Agents</strong> — these go into the auction pool. Your team holds matching rights; you don't spend a keeper slot on them.</div>
        <div class="kp-roster">${rfas.map(p => `<div class="kp-row" style="cursor:default;opacity:.85">
          <span class="kp-pos ${posClass(p.pos)}">${esc(p.pos)}</span>
          <span class="kp-name">${esc(p.player)}<span class="sub">${esc(p.rookieDeal||'Restricted FA')}</span></span>
          <span class="kp-val tbd">→ Auction (RFA)</span>
        </div>`).join('')}</div>` : '';
    return `
      <div class="kp-card">
        <div class="kp-totals">
          <div class="kp-stat"><span class="lbl">Team</span><span class="num" style="font-size:1rem">${esc(team)}</span></div>
          <div class="kp-stat"><span class="lbl">Players kept</span><span class="num ok" id="kp-count">0 / ${MAX_PLAYERS}</span></div>
          <div class="kp-stat"><span class="lbl">Keeper value</span><span class="num ok" id="kp-value">$0 / $${MAX_VALUE}</span></div>
        </div>
        <div class="kp-roster" id="kp-roster">${rowsHtml || '<div class="kp-intro">No keeper-eligible players found for this team.</div>'}</div>
        ${rfaHtml}
        <div class="kp-form-err kp-err" id="kp-form-err"></div>
        <div class="kp-submitbar">
          <button class="kp-btn" id="kp-submit">🔒 Submit &amp; Lock Keepers</button>
          <button class="kp-btn ghost" id="kp-switch">Switch team</button>
        </div>
      </div>`;
  }

  function submittedSummary(team) {
    const picks = (LEAGUE_DATA.keepers2026 && LEAGUE_DATA.keepers2026[team]) || [];
    let count = 0, value = 0;
    picks.forEach(k => { if (String(k.value) !== 'TBD') { count++; value += parseInt(k.value) || 0; } });
    const items = picks.map(k => `<div class="kp-row kept" style="cursor:default">
        <span class="kp-name">${esc(k.player)}</span>
        <span class="kp-val ${String(k.value)==='TBD'?'tbd':''}">${String(k.value)==='TBD'?'TBD ($0)':'$'+esc(k.value)}</span>
      </div>`).join('');
    return `<div class="kp-card">
      <div class="kp-locked-note"><strong>✓ Keepers submitted &amp; locked</strong> for ${esc(team)} — ${count} counted player(s), $${value} total value. To change them, ask the commissioner to reopen your team.</div>
      <div class="kp-roster">${items || '<div class="kp-intro">No keepers on record.</div>'}</div>
      <div class="kp-submitbar"><button class="kp-btn ghost" id="kp-switch">Switch team</button></div>
    </div>`;
  }

  function commDashboard() {
    const teams = (LEAGUE_DATA.teams || []).slice();
    const windowLocked = !!LEAGUE_DATA.keeperWindowLocked;
    const cards = teams.map(team => {
      const locked = !!(LEAGUE_DATA.keeperLocks && LEAGUE_DATA.keeperLocks[team]);
      const picks = (LEAGUE_DATA.keepers2026 && LEAGUE_DATA.keepers2026[team]) || [];
      let count = 0, value = 0;
      picks.forEach(k => { if (String(k.value) !== 'TBD') { count++; value += parseInt(k.value) || 0; } });
      return `<div class="kp-dash-team">
        <div class="nm">${esc(team)}</div>
        ${locked
          ? `<div class="st sub">✓ Submitted — ${count} players · $${value}</div>
             <button class="kp-btn ghost reopen" data-reopen="${esc(team)}">Reopen for edits</button>`
          : `<div class="st pend">⧗ Not submitted yet</div>`}
      </div>`;
    }).join('');
    const submitted = teams.filter(t => LEAGUE_DATA.keeperLocks && LEAGUE_DATA.keeperLocks[t]).length;
    const released = !!LEAGUE_DATA.rostersFull;
    // Live-write health check: comm tools are useless if Firebase Auth isn't signed in
    let fbUser = null;
    try { fbUser = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null; } catch(e) {}
    const fbStatus = fbUser
      ? `<span style="color:var(--green)">✓ Live database: signed in as ${esc(fbUser.email)}</span>`
      : `<span style="color:var(--red)">⚠ Live database: NOT signed in — every live write (rosters, draft picks, keeper tools) will be rejected and lost on reload. Fix: Firebase console → Authentication → add/repair user commissioner@msuffl.com with your commissioner password, then log out and back in here.</span>`;
    return `<div class="kp-dash">
      <div class="section-title" style="font-size:1.1rem">⚡ Commissioner — Keeper Submissions (${submitted}/${teams.length})</div>
      <div class="kp-intro" style="margin:.4rem 0">${fbStatus}</div>
      <div class="kp-submitbar" style="margin-top:.75rem">
        <button class="kp-btn ${windowLocked?'ghost':''}" id="kp-window-toggle">${windowLocked ? '🔓 Reopen submission window' : '🔒 Lock all keepers (close window)'}</button>
        <span class="kp-intro" style="margin:0">${windowLocked ? 'Window is CLOSED — teams cannot submit.' : 'Window is OPEN — teams can submit.'}</span>
      </div>
      <div class="kp-dash-grid">${cards}</div>

      <div class="kp-dash" style="margin-top:1.5rem">
        <div class="section-title" style="font-size:1rem">🗓️ Draft-day tools</div>
        <div class="kp-intro" style="margin:.5rem 0">Run these in order on draft day: <strong>1)</strong> after the rookie draft, promote rookies to rosters · <strong>2)</strong> let teams submit &amp; lock keepers · <strong>3)</strong> release non-keepers to build the auction pool.</div>
        <div class="kp-submitbar" style="margin-top:.25rem">
          <button class="kp-btn ghost" id="kp-promote-rookies">⬆️ Promote rookie picks to rosters ($1 each)</button>
          <button class="kp-btn" id="kp-release">🏷️ Release non-keepers → build auction rosters</button>
          ${released ? `<button class="kp-btn ghost" id="kp-restore">↩️ Restore full rosters</button>
          <span class="kp-intro" style="margin:0;color:var(--yellow)">Auction rosters are LIVE (non-keepers released).</span>` : ''}
        </div>
      </div>

      <div class="kp-dash" style="margin-top:1.5rem">
        <div class="section-title" style="font-size:1rem">💾 Save to site (permanent)</div>
        <div class="kp-submitbar" style="margin-top:.5rem">
          <button class="kp-btn" id="kp-save-github" style="background:var(--blue);color:#04210f">💾 Save everything to GitHub</button>
          <span class="kp-intro" style="margin:0">Bakes all current data into the deployed site (needs your GitHub token). Use this when the draft is final — it survives a database reset.</span>
        </div>
      </div>

      <div class="kp-dash" style="margin-top:1.5rem;border:1px solid var(--red);border-radius:12px;padding:1rem 1.1rem">
        <div class="section-title" style="font-size:1rem;color:var(--red)">⚠️ Danger zone</div>
        <div class="kp-submitbar" style="margin-top:.5rem">
          <button class="kp-btn" id="kp-reset-db" style="background:var(--red);color:#fff">🗑️ Reset live database</button>
          <span class="kp-intro" style="margin:0">Wipes <strong>all</strong> live data (keeper submissions, rookie picks, roster edits, auction board) and reloads using the data in the deployed file. Use this to clear test data. Cannot be undone.</span>
        </div>
      </div>
    </div>`;
  }

  function renderPortal() {
    const root = document.getElementById('kp-root');
    if (!root) return;
    LEAGUE_DATA.keepers2026 = LEAGUE_DATA.keepers2026 || {};
    LEAGUE_DATA.keeperLocks = LEAGUE_DATA.keeperLocks || {};
    const isComm = !!(window.commMode && window.commMode.isUnlocked());
    const windowLocked = !!LEAGUE_DATA.keeperWindowLocked;

    let html = `<div class="kp-intro">Each team keeps any combination of up to <strong>${MAX_PLAYERS} players</strong> worth up to <strong>$${MAX_VALUE}</strong> in total keeper value. Rookie-deal / restricted-FA players marked <strong>TBD</strong> are free — they don't count toward your player count or your budget. Pick your team, enter your PIN, and submit before the draft.</div>`;
    html += `<div class="kp-banner ${windowLocked?'closed':''}">${windowLocked ? '🔒 Keeper submissions are closed for the season.' : '🟢 Keeper submissions are open. Submit before the draft — once you submit, your picks lock.'}</div>`;

    if (!unlockedTeam) {
      const opts = (LEAGUE_DATA.teams || []).map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
      html += `<div class="kp-card">
        <div class="kp-gate-row">
          <div class="kp-field"><label>Your team</label>
            <select class="kp-select" id="kp-team"><option value="">— Select your team —</option>${opts}</select></div>
          <div class="kp-field"><label>Team PIN</label>
            <input class="kp-pin" id="kp-pin-input" maxlength="10" placeholder="••••••" autocomplete="off"></div>
          <button class="kp-btn" id="kp-unlock">Unlock</button>
        </div>
        <div class="kp-err" id="kp-gate-err"></div>
      </div>`;
    } else if (LEAGUE_DATA.keeperLocks[unlockedTeam]) {
      html += submittedSummary(unlockedTeam);
    } else if (windowLocked) {
      html += `<div class="kp-card"><div class="kp-locked-note">Submissions are closed. Contact the commissioner if you still need to submit keepers for <strong>${esc(unlockedTeam)}</strong>.</div>
        <div class="kp-submitbar"><button class="kp-btn ghost" id="kp-switch">Switch team</button></div></div>`;
    } else {
      html += renderForm(unlockedTeam);
    }

    if (isComm) html += commDashboard();
    root.innerHTML = html;
    wire(root, isComm);
  }

  function wire(root, isComm) {
    const unlockBtn = root.querySelector('#kp-unlock');
    if (unlockBtn) {
      const tryUnlock = async () => {
        const team = root.querySelector('#kp-team').value;
        const pin  = (root.querySelector('#kp-pin-input').value || '').trim().toUpperCase();
        const err  = root.querySelector('#kp-gate-err');
        if (!team) { err.textContent = 'Select your team first.'; return; }
        if (!pin)  { err.textContent = 'Enter your team PIN.'; return; }
        const h = await sha256(pin);
        if (h === TEAM_PIN_HASHES[team]) { err.textContent = ''; unlockedTeam = team; await fetchLatest(); renderPortal(); }
        else { err.textContent = 'Incorrect PIN for that team.'; }
      };
      unlockBtn.addEventListener('click', tryUnlock);
      root.querySelector('#kp-pin-input').addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });
    }
    const roster = root.querySelector('#kp-roster');
    if (roster && root.querySelector('#kp-submit')) { roster.addEventListener('change', recalc); recalc(); }
    const submit = root.querySelector('#kp-submit');
    if (submit) submit.addEventListener('click', () => doSubmit(unlockedTeam));
    const sw = root.querySelector('#kp-switch');
    if (sw) sw.addEventListener('click', () => { unlockedTeam = null; renderPortal(); });

    if (isComm) {
      root.querySelectorAll('[data-reopen]').forEach(b => b.addEventListener('click', async () => {
        const team = b.dataset.reopen;
        if (!confirm(`Reopen keeper editing for ${team}? Their current submission stays until they re-submit.`)) return;
        delete LEAGUE_DATA.keeperLocks[team];
        // Delete the team's submission node too, otherwise the live merge re-locks them.
        if (window.fbSet) await window.fbSet(`keeper_submissions/${window.fbTeamKey(team)}`, null);
        const ok = window.commSave && await window.commSave.saveData('LEAGUE_DATA', LEAGUE_DATA, `Commissioner: reopen keepers for ${team}`);
        if (ok === false) pushToFirebase(); else pushToFirebase();
        renderPortal();
      }));
      const wt = root.querySelector('#kp-window-toggle');
      if (wt) wt.addEventListener('click', async () => {
        const closing = !LEAGUE_DATA.keeperWindowLocked;
        if (!confirm(closing ? 'Lock ALL keepers and close the submission window? Teams will no longer be able to submit.' : 'Reopen the submission window so teams can submit again?')) return;
        LEAGUE_DATA.keeperWindowLocked = closing;
        if (window.commSave) await window.commSave.saveData('LEAGUE_DATA', LEAGUE_DATA, `Commissioner: ${closing ? 'close' : 'reopen'} keeper window`);
        pushToFirebase();
        renderPortal();
      });
      const pr = root.querySelector('#kp-promote-rookies');
      if (pr) pr.addEventListener('click', () => promoteRookies());
      const rel = root.querySelector('#kp-release');
      if (rel) rel.addEventListener('click', () => releaseNonKeepers());
      const rst = root.querySelector('#kp-restore');
      if (rst) rst.addEventListener('click', () => restoreFullRosters());
      const rdb = root.querySelector('#kp-reset-db');
      if (rdb) rdb.addEventListener('click', () => resetDatabase());
      const sgh = root.querySelector('#kp-save-github');
      if (sgh) sgh.addEventListener('click', () => saveAllToGitHub());
    }
  }

  // Expose so commissioner login refresh can re-render if desired
  window.kpRender = renderPortal;

  function init() {
    const navBtn = document.querySelector('.nav-btn[data-page="submitkeepers"]');
    if (navBtn) navBtn.addEventListener('click', async () => { await fetchLatest(); renderPortal(); });
    renderPortal();
    if (location.hash === '#submitkeepers') { fetchLatest().then(renderPortal); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
