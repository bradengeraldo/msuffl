// ===================== DATA =====================

// Self-reported build of THIS file. Stamped into the on-screen build marker so we
// can tell whether app.js itself actually updated on the server — the index.html
// stamp only proves index.html updated, not this script.
const APP_BUILD = '2026-07-03f';
(function stampAppBuild(){
  function paint(){
    const el = document.getElementById('app-build');
    if (el) el.textContent = APP_BUILD;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint);
  else paint();
})();

const MGR_TO_TEAM = LEAGUE_DATA.managers;
const TEAM_TO_MGR = Object.fromEntries(Object.entries(MGR_TO_TEAM).map(([k,v]) => [v,k]));

// ===================== NAVIGATION =====================
const navBtns = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page');

function showPage(pageId) {
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.page === pageId));
  pages.forEach(p => p.classList.toggle('active', p.id === `page-${pageId}`));
  // Reset roster detail
  if (pageId !== 'rosters') {
    document.getElementById('rosters-list-view').style.display = '';
    document.getElementById('team-detail-view').style.display = 'none';
  }
}

navBtns.forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)));

// Re-render the 2026 Keepers tab on navigation so its reveal/hidden state and any
// freshly-synced submissions are always current when a viewer opens it.
document.querySelector('.nav-btn[data-page="keepers"]')
  ?.addEventListener('click', () => { try { buildKeepers(); } catch(e){} });

// ── Hash-based page persistence ──────────────────────────────────────────────
(function() {
  const _origSP = showPage;
  showPage = function(pageId) {
    _origSP(pageId);
    if (pageId) history.replaceState(null, '', location.pathname + '#' + pageId);
  };
  // On load, navigate to the hash page (if any).
  // 'submitkeepers' was merged into the 2026 Keepers tab — redirect old links.
  let hashPage = location.hash.slice(1);
  if (hashPage === 'submitkeepers') hashPage = 'keepers';
  // Trades and Write Ups are now sub-tabs inside League History.
  if (hashPage === 'trades' || hashPage === 'writeups') hashPage = 'history';
  if (hashPage) {
    // May run before DOM-built pages are ready; defer slightly
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => showPage(hashPage));
    } else {
      showPage(hashPage);
    }
  }
})();

// ===================== POS COLOR =====================
function posClass(pos) {
  if (!pos) return '';
  const p = pos.toUpperCase().replace('/ST','').replace('D/','DST');
  if (p.includes('QB')) return 'pos-QB';
  if (p.includes('RB')) return 'pos-RB';
  if (p.includes('WR')) return 'pos-WR';
  if (p.includes('TE')) return 'pos-TE';
  if (p === 'K') return 'pos-K';
  if (p.includes('DST') || p.includes('D/ST')) return 'pos-DST';
  return '';
}

function formatPos(pos) {
  return pos ? pos.replace('D/ST', 'DST') : '';
}

// ===================== HOME PAGE =====================
function buildHome() {
  const grid = document.getElementById('home-teams-grid');

  // Map current team name -> owner full name using the most recent season,
  // so we can pull career stats (seasons, win%, titles) from HISTORY_DATA.
  const teamToOwner = {};
  const histYears = (HISTORY_DATA.years || []).slice().sort((a,b) => b - a);
  const latestSeason = histYears.length ? HISTORY_DATA.seasons[histYears[0]] : null;
  if (latestSeason) {
    latestSeason.teams.forEach(t => { teamToOwner[t.name] = t.owner; });
  }
  // Fallback: team names occasionally differ in spelling between the roster
  // data and the history data, so also resolve via the manager's first name.
  const ownerFirstName = {};
  Object.keys(HISTORY_DATA.ownerStats).forEach(o => {
    ownerFirstName[o.split(' ')[0].toLowerCase()] = o;
  });

  // Build per-team career stats, then sort most-decorated first
  // (titles desc, then win% desc, then name) so the trophy case leads.
  const teamRows = Object.keys(LEAGUE_DATA.rosters).map(team => {
    const mgr = TEAM_TO_MGR[team] || team;
    let owner = teamToOwner[team];
    if (!owner) {
      const firstKey = (mgr.split(/[\/ ]/)[0] || '').toLowerCase();
      owner = ownerFirstName[firstKey];
    }
    const ostats = owner ? HISTORY_DATA.ownerStats[owner] : null;
    return {
      team, mgr,
      seasons: ostats ? ostats.seasons_played : '—',
      wpct: ostats ? ostats.wpct : -1,
      winPct: ostats ? (ostats.wpct * 100).toFixed(1) + '%' : '—',
      titles: ostats ? ostats.titles : 0,
    };
  });
  teamRows.sort((a, b) =>
    b.titles - a.titles ||
    b.wpct - a.wpct ||
    a.team.localeCompare(b.team)
  );

  const cardHtml = r => `<div class="team-card" data-team="${escHtml(r.team)}">
      <div class="team-name">${escHtml(r.team)}</div>
      <div class="team-manager">${r.mgr}</div>
      <div class="team-stats-row">
        <div class="team-mini-stat">
          <span class="val">${r.seasons}</span>
          <span class="lbl">Seasons</span>
        </div>
        <div class="team-mini-stat">
          <span class="val">${r.winPct}</span>
          <span class="lbl">Win %</span>
        </div>
        <div class="team-mini-stat">
          <span class="val">${r.titles}${r.titles ? ' 🏆' : ''}</span>
          <span class="lbl">${r.titles === 1 ? 'Title' : 'Titles'}</span>
        </div>
      </div>
    </div>`;

  // Group the sorted teams into championship tiers.
  const categories = [
    { title: 'Multi-time Champions', rows: teamRows.filter(r => r.titles >= 2) },
    { title: 'One-time Champions',   rows: teamRows.filter(r => r.titles === 1) },
    { title: 'Yet-to-be Champions',  rows: teamRows.filter(r => r.titles === 0) },
  ];
  grid.innerHTML = categories
    .filter(c => c.rows.length)
    .map((c, i) => `
      <div class="section-title"${i ? ' style="margin-top:2rem"' : ''}>${c.title}</div>
      <div class="teams-grid">${c.rows.map(cardHtml).join('')}</div>
    `).join('');
  grid.addEventListener('click', e => {
    const card = e.target.closest('.team-card[data-team]');
    if (card) showTeamDetail(card.dataset.team);
  });
}


// ===================== ROSTER ANALYSIS =====================
let _rosterTeam = null;
let _rosterEntries = [];

function _getRosterPlayer(entry) {
  const msu = window._MSU;
  if (!msu) return null;
  const { SP_DATA, TP, estimateFairAuctionValue, estimateDefaultKeeperCost } = msu;
  const rawName = (entry.player || '').trim();
  const nameLower = rawName.toLowerCase();
  let sp = null, spKey = rawName;
  for (const k of Object.keys(SP_DATA)) {
    if (k.toLowerCase() === nameLower) { sp = SP_DATA[k]; spKey = k; break; }
  }
  const tp = TP.find(p => p.name.toLowerCase() === nameLower);
  const rawPos = (entry.pos || 'WR').replace('D/ST', 'DST');
  const pos = ['QB','RB','WR','TE','K','DST'].includes(rawPos) ? rawPos : 'WR';
  const adp = tp ? tp.adp : 150;
  const val = tp ? tp.val : (sp ? Math.max(10, Math.round(sp.f * 0.7)) : 15);
  const age = tp ? tp.age : 26;
  return { name: spKey, pos, age, val, adp };
}

function _analyzeRoster(entries) {
  const msu = window._MSU;
  if (!msu || !entries || !entries.length) return null;
  const { calcVal, calcWinNow, calcRebuild, calcSurplus } = msu;
  const players = entries.map(_getRosterPlayer).filter(Boolean).filter(p => p.adp < 999);
  if (!players.length) return null;
  const sorted = [...players].sort((a, b) => calcVal(b) - calcVal(a));
  const starters = sorted.slice(0, 8);
  const bench    = sorted.slice(8);
  const wnNum = starters.reduce((s,p) => s + calcWinNow(p), 0) + bench.reduce((s,p) => s + calcWinNow(p) * 0.25, 0);
  const wnDen = starters.length + bench.length * 0.25 || 1;
  const winNow = Math.round(wnNum / wnDen);
  const rbNum = players.reduce((s,p) => s + calcRebuild(p) * (p.age <= 24 ? 1.5 : 1), 0);
  const rbDen = players.reduce((s,p) => s + (p.age <= 24 ? 1.5 : 1), 0) || 1;
  const rebuild = Math.round(rbNum / rbDen);
  const keptEntries = entries.filter(e => e.val2026 && e.val2026 !== 'TBD' && !isNaN(parseInt(e.val2026)));
  let surplusTotal = 0;
  const contractDetails = [];
  keptEntries.forEach(e => {
    const p = _getRosterPlayer(e);
    if (!p) return;
    const { cost, fair, surplus } = calcSurplus(p);
    surplusTotal += surplus;
    contractDetails.push({ name: e.player, cost, fair, surplus: Math.round(surplus) });
  });
  surplusTotal = Math.round(surplusTotal);
  const byPos = { QB: [], RB: [], WR: [], TE: [] };
  players.forEach(p => { if (byPos[p.pos]) byPos[p.pos].push(p); });
  const posGrades = {};
  ['QB','RB','WR','TE'].forEach(pos => {
    const pp = (byPos[pos] || []).sort((a,b) => calcVal(b) - calcVal(a));
    if (!pp.length) { posGrades[pos] = { score: 0, grade: 'F' }; return; }
    const weights = (pos === 'QB' || pos === 'TE') ? [1.0] : [1.0, 0.7, 0.4, 0.2];
    let tot = 0, w = 0;
    pp.slice(0, weights.length).forEach((p, i) => { tot += calcVal(p) * weights[i]; w += weights[i]; });
    const score = Math.round(tot / w);
    posGrades[pos] = { score, grade: score >= 78 ? 'A' : score >= 62 ? 'B' : score >= 46 ? 'C' : score >= 30 ? 'D' : 'F' };
  });
  contractDetails.sort((a, b) => b.surplus - a.surplus);
  return { winNow, rebuild, surplusTotal, posGrades, contractDetails };
}

function _rosterVerdict(a) {
  if (!a) return '';
  const { winNow, rebuild, surplusTotal, posGrades, contractDetails } = a;
  const parts = [];
  if (winNow >= 70 && rebuild < 52)
    parts.push('A clear <strong>win-now roster</strong> built for this season. The window is open — depth and health will determine the ceiling.');
  else if (rebuild >= 68 && winNow < 52)
    parts.push('A team in <strong>full rebuild mode</strong> with significant youth and long-term upside. Draft capital and young talent are the story.');
  else if (winNow >= 62 && rebuild >= 62)
    parts.push('A <strong>balanced contender</strong> with both immediate firepower and future assets. Few glaring weaknesses.');
  else
    parts.push('A <strong>transitional roster</strong> caught between competing now and building for the future. Key moves could tilt this either direction.');
  const strong = ['QB','RB','WR','TE'].filter(p => 'AB'.includes((posGrades[p] || {}).grade || ''));
  const weak   = ['QB','RB','WR','TE'].filter(p => 'DF'.includes((posGrades[p] || {}).grade || ''));
  if (strong.length) parts.push('Strongest at <strong>' + strong.join(' &amp; ') + '</strong>.');
  if (weak.length)   parts.push('Thinnest at <strong>' + weak.join(' &amp; ') + '</strong> — a prime target in trades or FAAB.');
  if (surplusTotal >= 25)
    parts.push('Exceptional contract value: <strong>$' + surplusTotal + ' total surplus</strong> locked in.');
  else if (surplusTotal >= 10)
    parts.push('Solid keeper value with a $' + surplusTotal + ' surplus overall.');
  else if (surplusTotal <= -15)
    parts.push('Carrying $' + Math.abs(surplusTotal) + ' over market in keeper contracts — flexibility is limited.');
  const best = contractDetails[0];
  if (best && best.surplus >= 8)
    parts.push('Best deal on the roster: <strong>' + best.name + '</strong> at $' + best.cost + ' ($' + best.surplus + ' surplus).');
  return parts.join(' ');
}

function _renderRosterAnalysis(analysis) {
  if (!analysis) return '<div class="roster-analysis" id="roster-analysis"><p style="color:var(--muted);font-size:0.83rem">Loading analysis…</p></div>';
  const { winNow, rebuild, surplusTotal, posGrades } = analysis;
  const lvl  = s => s >= 65 ? 'high' : s >= 42 ? 'mid' : 'low';
  const slvl = s => s >= 15 ? 'high' : s >= -10 ? 'mid' : 'low';
  const wnTag = winNow >= 75 ? 'Contender' : winNow >= 60 ? 'Fringe' : winNow >= 45 ? 'Developing' : 'Rebuilding';
  const rbTag = rebuild >= 70 ? 'Dynasty Asset' : rebuild >= 55 ? 'Promising' : rebuild >= 40 ? 'Mixed' : 'Aging Core';
  const surpSign = surplusTotal >= 0 ? '+' : '';
  const surpTag  = surplusTotal >= 20 ? 'Great Value' : surplusTotal >= 5 ? 'Fair' : surplusTotal >= -10 ? 'Slight Overpay' : 'Expensive';
  const surpBarPct = Math.min(100, Math.max(0, 50 + surplusTotal * 0.9));
  const posHtml = ['QB','RB','WR','TE'].map(pos => {
    const g = posGrades[pos] || { grade: 'F' };
    const gl = g.grade[0];
    return '<div class="ra-pos-item"><span class="pos-badge ' + pos.toLowerCase() + '">' + pos + '</span><span class="ra-grade ' + gl + '">' + g.grade + '</span></div>';
  }).join('');
  return '<div class="roster-analysis" id="roster-analysis">' +
    '<div class="ra-title">⚡ Roster Analysis</div>' +
    '<div class="ra-scores">' +
      '<div class="ra-score ' + lvl(winNow) + '">' +
        '<div class="ra-score-label">Win-Now</div>' +
        '<div class="ra-score-num">' + winNow + '</div>' +
        '<div class="ra-score-bar"><div class="ra-score-fill" style="width:' + winNow + '%"></div></div>' +
        '<div class="ra-score-tag">' + wnTag + '</div>' +
      '</div>' +
      '<div class="ra-score ' + lvl(rebuild) + '">' +
        '<div class="ra-score-label">Rebuild</div>' +
        '<div class="ra-score-num">' + rebuild + '</div>' +
        '<div class="ra-score-bar"><div class="ra-score-fill" style="width:' + rebuild + '%"></div></div>' +
        '<div class="ra-score-tag">' + rbTag + '</div>' +
      '</div>' +
      '<div class="ra-score ' + slvl(surplusTotal) + '">' +
        '<div class="ra-score-label">Contract Surplus</div>' +
        '<div class="ra-score-num">' + surpSign + '$' + surplusTotal + '</div>' +
        '<div class="ra-score-bar"><div class="ra-score-fill" style="width:' + surpBarPct + '%"></div></div>' +
        '<div class="ra-score-tag">' + surpTag + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="ra-pos-row">' + posHtml + '</div>' +
    '<div class="ra-verdict">' + _rosterVerdict(analysis) + '</div>' +
  '</div>';
}

function _updateRosterAnalysisPanel() {
  const detail = document.getElementById('team-detail-content');
  if (!detail || !_rosterEntries.length) return;
  const excluded = new Set();
  detail.querySelectorAll('.player-toggle-row.excluded').forEach(row => {
    excluded.add(row.dataset.playerName || '');
  });
  const active = _rosterEntries.filter(e => !excluded.has(e.player));
  const analysis = _analyzeRoster(active.length ? active : _rosterEntries);
  const newHtml = _renderRosterAnalysis(analysis);
  const existing = detail.querySelector('#roster-analysis');
  if (existing) {
    existing.outerHTML = newHtml;
  } else {
    const cardWrap = detail.querySelector('.card-wrap');
    if (cardWrap) cardWrap.insertAdjacentHTML('beforebegin', newHtml);
  }
}

// ===================== ROSTER PAGE =====================
function buildRosters() {
  const grid = document.getElementById('rosters-teams-grid');
  const teams = Object.keys(LEAGUE_DATA.rosters).sort();
  grid.innerHTML = teams.map(team => {
    const mgr = TEAM_TO_MGR[team] || team;
    const budget = LEAGUE_DATA.budgets[team];
    const roster = LEAGUE_DATA.rosters[team] || [];
    const rem = budget ? parseInt(budget.remaining) : 0;
    return `<div class="team-card" data-team="${escHtml(team)}">
      <div class="team-name">${escHtml(team)}</div>
      <div class="team-manager">${mgr}</div>
      <div class="team-stats-row">
        <div class="team-mini-stat">
          <span class="val">${roster.length}</span>
          <span class="lbl">Players</span>
        </div>
        ${budget ? `
        <div class="team-mini-stat">
          <span class="val ${rem >= 0 ? 'positive' : 'negative'}">${rem >= 0 ? '+' : ''}${rem}</span>
          <span class="lbl">FAAB Left</span>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
  grid.addEventListener('click', e => {
    const card = e.target.closest('.team-card[data-team]');
    if (card) showTeamDetail(card.dataset.team);
  });
}

function showTeamDetail(team) {
  // Works from both home and rosters page — navigate to rosters
  showPage('rosters');
  document.getElementById('rosters-list-view').style.display = 'none';
  document.getElementById('team-detail-view').style.display = '';

  const roster = LEAGUE_DATA.rosters[team] || [];
  _rosterTeam = team;
  _rosterEntries = roster;
  const mgr = TEAM_TO_MGR[team] || team;
  const budget = LEAGUE_DATA.budgets[team];

  // Sort by position order
  const posOrder = ['QB','RB','WR','TE','K','D/ST','DST'];
  const sorted = [...roster].sort((a, b) => {
    const ai = posOrder.findIndex(p => a.pos && a.pos.includes(p));
    const bi = posOrder.findIndex(p => b.pos && b.pos.includes(p));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const budgetHtml = budget ? `
    <div class="budget-cards">
      <div class="budget-card">
        <span class="bval">$${budget.budget}</span>
        <span class="blbl">Budget</span>
      </div>
      <div class="budget-card">
        <span class="bval scenario-kept">${budget.totalKept}</span>
        <span class="blbl">Kept $</span>
      </div>
      <div class="budget-card">
        <span class="bval scenario-remaining ${parseInt(budget.remaining) < 0 ? 'neg' : ''}">${parseInt(budget.remaining) >= 0 ? '+' : ''}${budget.remaining}</span>
        <span class="blbl">Remaining</span>
      </div>
      <div class="budget-card">
        <span class="bval scenario-count">${budget.playerCount}</span>
        <span class="blbl">Keepers</span>
      </div>
      <div class="budget-card">
        <span class="bval scenario-faab ${parseInt(budget.inSeasonFaab) < 0 ? 'neg' : ''}">${parseInt(budget.inSeasonFaab) >= 0 ? '+' : ''}${budget.inSeasonFaab}</span>
        <span class="blbl">In-Season FAAB</span>
      </div>
    </div>` : '';

  const rows = sorted.map(p => {
    const isRookie = p.rookieDeal && p.rookieDeal !== 'N' && p.rookieDeal !== 'nan';
    const rookieTag = isRookie ? `<span class="rookie-tag">R</span>` : '';
    const posStr = formatPos(p.pos);
    const pClass = posClass(p.pos);
    const v26 = p.val2026 || '—';
    const v25 = p.val2025 || '—';
    const val25Num = parseInt(p.val2025) || 0;
    const val26Num = parseInt(p.val2026) || 0;
    return `<tr class="player-toggle-row" data-val25="${val25Num}" data-val26="${val26Num}" data-player-name="${escHtml(p.player)}">
      <td class="toggle-cell"><span class="toggle-dot"></span></td>
      <td><span class="pos-badge ${pClass}">${posStr}</span></td>
      <td class="player-name">${escHtml(p.player)}${rookieTag}</td>
      <td class="val-mono">${escHtml(v25)}</td>
      <td class="val-mono highlight">${escHtml(v26)}</td>
    </tr>`;
  }).join('');

  document.getElementById('team-detail-content').innerHTML = `
    <div class="team-detail-header">
      <div>
        <h2>${escHtml(team)}</h2>
        <div class="mgr-label"><span class="green-dot"></span>${mgr}</div>
      </div>
      ${budgetHtml}
    </div>
    <div class="scenario-banner" id="scenario-banner">
      <span>⚡ Scenario mode — click players to toggle</span>
      <button class="scenario-reset-btn" id="scenario-reset">Reset All</button>
    </div>
  <div class="card-wrap"><div class="table-scroll">
      <table class="roster-table">
        <thead>
          <tr>
            <th class="toggle-th"></th>
            <th>Pos</th>
            <th>Player</th>
            <th>2025 Value</th>
            <th>2026 Value</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div></div>`;
  // Wire scenario row toggles — runs every call so fresh rows get listeners
  // State is NOT persisted; toggled players reset automatically on page load
  const _detail = document.getElementById('team-detail-content');
  _detail.querySelectorAll('.player-toggle-row').forEach(row => {
    row.addEventListener('click', () => {
      row.classList.toggle('excluded');
      recalcScenario(budget);
      _updateRosterAnalysisPanel();
    });
  });
  const _resetBtn = document.getElementById('scenario-reset');
  if (_resetBtn) {
    _resetBtn.addEventListener('click', e => {
      e.stopPropagation();
      _detail.querySelectorAll('.player-toggle-row').forEach(r => r.classList.remove('excluded'));
      recalcScenario(budget);
      _updateRosterAnalysisPanel();
    });
  }
  // Render roster analysis panel (window._MSU is set by IIFE which runs at page load)
  _updateRosterAnalysisPanel();
}


// ── Scenario toggle event wiring (runs after showTeamDetail sets innerHTML) ──
function recalcScenario(budget) {
  const detail = document.getElementById('team-detail-content');
  if (!detail) return;
  const toggleRows = detail.querySelectorAll('.player-toggle-row');
  // Track EXCLUDED sum as a delta off the original budget values.
  // This keeps the baseline anchored to budget.totalKept (which may differ
  // from the raw sum of val2025 due to TBD/0 players) so math stays accurate.
  let activeCount = 0, excludedSum = 0, anyExcluded = false;
  toggleRows.forEach(row => {
    if (row.classList.contains('excluded')) {
      anyExcluded = true;
      excludedSum += parseInt(row.dataset.val26) || 0;
    } else {
      activeCount++;
    }
  });
  const banner = document.getElementById('scenario-banner');
  if (banner) banner.classList.toggle('active', anyExcluded);
  const keptEl  = detail.querySelector('.scenario-kept');
  const remEl   = detail.querySelector('.scenario-remaining');
  const cntEl   = detail.querySelector('.scenario-count');
  const faabEl  = detail.querySelector('.scenario-faab');
  if (!budget) return;
  const origKept = parseInt(budget.totalKept);
  const newKept  = origKept - excludedSum;
  const newRem   = parseInt(budget.budget) - newKept;
  const newFaab  = parseInt(budget.inSeasonFaab) + excludedSum;
  if (keptEl) keptEl.textContent = newKept;
  if (cntEl)  cntEl.textContent  = activeCount;
  if (remEl) {
    remEl.textContent  = (newRem >= 0 ? '+' : '') + newRem;
    remEl.className = 'bval scenario-remaining' + (newRem < 0 ? ' neg' : '');
  }
  if (faabEl) {
    faabEl.textContent = (newFaab >= 0 ? '+' : '') + newFaab;
    faabEl.className = 'bval scenario-faab' + (newFaab < 0 ? ' neg' : '');
  }
}

document.getElementById('back-to-rosters').addEventListener('click', () => {
  document.getElementById('rosters-list-view').style.display = '';
  document.getElementById('team-detail-view').style.display = 'none';
});

// Roster search
document.getElementById('roster-search').addEventListener('input', function() {
  const q = this.value.toLowerCase().trim();
  const cards = document.querySelectorAll('#rosters-teams-grid .team-card');
  if (!q) {
    cards.forEach(c => c.style.display = '');
    return;
  }
  // Search through roster data
  const teams = Object.keys(LEAGUE_DATA.rosters);
  const matchedTeams = new Set();
  teams.forEach(team => {
    const mgr = TEAM_TO_MGR[team] || '';
    if (team.toLowerCase().includes(q) || mgr.toLowerCase().includes(q)) {
      matchedTeams.add(team);
      return;
    }
    const roster = LEAGUE_DATA.rosters[team] || [];
    if (roster.some(p => p.player.toLowerCase().includes(q))) {
      matchedTeams.add(team);
    }
  });
  cards.forEach(card => {
    const onclick = card.getAttribute('onclick');
    const teamMatch = [...matchedTeams].some(t => onclick && onclick.includes(t.replace(/'/g,"\\'")));
    // simpler: check the team name text
    const teamName = card.querySelector('.team-name')?.textContent?.toLowerCase() || '';
    const mgrName = card.querySelector('.team-manager')?.textContent?.toLowerCase() || '';
    const show = matchedTeams.has(card.querySelector('.team-name')?.textContent?.trim());
    card.style.display = show ? '' : 'none';
  });
});

// ===================== KEEPERS PAGE =====================
function buildKeepers() {
  const grid = document.getElementById('keepers-grid');
  if (!grid) return;

  const locks        = LEAGUE_DATA.keeperLocks || {};
  const windowLocked = !!LEAGUE_DATA.keeperWindowLocked;
  const isComm       = !!(window.commMode && window.commMode.isUnlocked());
  // Keepers stay hidden from everyone until the commissioner closes the window
  // ("Lock all keepers"). The commissioner can always see them.
  const reveal       = windowLocked || isComm;

  // All teams, in a stable order, so every team shows even before submitting.
  const teams = (LEAGUE_DATA.teams && LEAGUE_DATA.teams.length
    ? LEAGUE_DATA.teams.slice()
    : Object.keys(LEAGUE_DATA.keepers2026 || {})).sort();

  // ── Status banner above the grid ─────────────────────────────────────────
  let banner = document.getElementById('keepers-status-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'keepers-status-banner';
    banner.className = 'keepers-status-banner';
    grid.parentNode.insertBefore(banner, grid);
  }
  const submitted = teams.filter(t => locks[t]).length;
  if (reveal) {
    banner.className = 'keepers-status-banner revealed';
    banner.innerHTML = windowLocked
      ? `🔒 <strong>Keepers are locked.</strong> Final keepers for all ${teams.length} teams are shown below — review before the draft.`
      : `👁️ <strong>Commissioner preview.</strong> Keepers are still hidden from managers until you click “Lock all keepers (close window)”. ${submitted}/${teams.length} teams have submitted.`;
  } else {
    banner.className = 'keepers-status-banner hidden-state';
    banner.innerHTML = `<strong>Keepers are hidden until the submission window closes.</strong> ${submitted}/${teams.length} teams have submitted. Everyone’s keepers will appear here once the commissioner locks them.`;
  }

  // ── Hidden state: show only submission status, not the picks ──────────────
  if (!reveal) {
    grid.innerHTML = teams.map(team => {
      const done = !!locks[team];
      return `<div class="keeper-team-card">
        <div class="keeper-team-header">
          <h3>${escHtml(team)}</h3>
          <span class="keeper-budget-badge ${done ? '' : 'over'}">${done ? '✓ Submitted' : '⧗ Pending'}</span>
        </div>
        <div class="keeper-player-list"><div class="empty-state">${done ? 'Locked in — hidden until reveal' : 'Not submitted yet'}</div></div>
      </div>`;
    }).join('');
    return;
  }

  // ── Revealed state: full keepers for every team ──────────────────────────
  grid.innerHTML = teams.map(team => {
    const keepers = LEAGUE_DATA.keepers2026[team] || [];
    const budget = LEAGUE_DATA.budgets && LEAGUE_DATA.budgets[team];
    const rem = budget ? parseInt(budget.remaining) : 0;
    const isOver = rem < 0;
    const total = budget ? budget.totalKept : '—';
    const done = !!locks[team];

    const playerItems = keepers.map(k =>
      `<div class="keeper-player-item">
        <span class="keeper-player-name">${escHtml(k.player)}</span>
        <span class="keeper-player-val">$${escHtml(k.value)}</span>
      </div>`
    ).join('');

    return `<div class="keeper-team-card">
      <div class="keeper-team-header">
        <h3>${escHtml(team)} ${done ? '<span class="keeper-lock-chip">🔒</span>' : '<span class="keeper-lock-chip pending" title="Did not submit — showing projected keepers">⧗</span>'}</h3>
        <span class="keeper-budget-badge ${isOver ? 'over' : ''}">$${total} / $200</span>
      </div>
      <div class="keeper-player-list">${playerItems || '<div class="empty-state">No keepers</div>'}</div>
    </div>`;
  }).join('');
}

// ===================== DRAFT PAGE =====================
function buildDraft() {
  const tabsEl = document.getElementById('draft-year-tabs');
  const contentEl = document.getElementById('draft-content');
  const years = Object.keys(LEAGUE_DATA.drafts).sort((a,b) => b-a);

  // ── Live rookie draft mode (commissioner starts/ends it from the edit bar) ──
  const _rdLive = LEAGUE_DATA.liveRookieDraft;
  const liveYear = (_rdLive && _rdLive.active && LEAGUE_DATA.drafts[_rdLive.year]) ? String(_rdLive.year) : null;
  const _rdIsPlaceholder = p => !p || /^\s*round\s*\d+\s*,\s*pick\s*\d+\s*(\(\s*\d+\s*\))?\s*$/i.test(String(p).trim());
  if (!document.getElementById('rd-live-style')) {
    const st = document.createElement('style');
    st.id = 'rd-live-style';
    st.textContent = `
.rd-live-banner{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;background:rgba(139,0,0,.18);border:1px solid #c0392b;border-radius:10px;padding:.6rem 1rem;margin-bottom:1rem;font-size:.95rem}
.rd-live-dot{width:10px;height:10px;border-radius:50%;background:#e74c3c;animation:rdpulse 1.2s infinite;flex:0 0 auto}
@keyframes rdpulse{0%,100%{opacity:1}50%{opacity:.25}}
.rd-live-onclock{font-weight:700}
.rd-last-pick{opacity:.75;font-size:.85rem}
.draft-pick.rd-onclock{outline:2px solid #e74c3c;border-radius:8px;animation:rdpulsebg 2s infinite}
@keyframes rdpulsebg{0%,100%{background:rgba(231,76,60,.10)}50%{background:rgba(231,76,60,.22)}}
.draft-pick.rd-onclock .pick-player.empty{color:#e74c3c;font-weight:700}`;
    document.head.appendChild(st);
  }

  // Year shown after a rebuild: the live year always wins; otherwise keep whatever
  // tab the viewer was last looking at so background refreshes don't yank them away.
  const defaultYear = liveYear || (years.includes(window.__draftYearShown) ? window.__draftYearShown : years[0]);
  tabsEl.innerHTML = years.map((yr) =>
    `<button class="year-tab ${yr === defaultYear ? 'active' : ''}" data-year="${yr}">${yr}${yr === liveYear ? ' 🔴' : ''}</button>`
  ).join('');

  function renderDraft(year) {
    const picks = LEAGUE_DATA.drafts[year] || [];
    const isLive = liveYear && String(year) === liveYear;
    const onClockIdx = isLive ? picks.findIndex(p => _rdIsPlaceholder(p.player)) : -1;
    let html = '';

    if (isLive) {
      const made = picks.map((p, i) => ({ p, i })).filter(x => !_rdIsPlaceholder(x.p.player));
      const last = made.length ? made[made.length - 1] : null;
      const onClock = onClockIdx >= 0 ? picks[onClockIdx] : null;
      html += `<div class="rd-live-banner">
        <span class="rd-live-dot"></span>
        <span><strong>LIVE</strong> — ${escHtml(year)} Rookie Draft in progress</span>
        ${onClock
          ? `<span class="rd-live-onclock">⏰ On the clock: ${escHtml(onClock.team || 'TBD')} (${escHtml(onClock.round)}, ${escHtml(onClock.pick)})</span>`
          : `<span class="rd-live-onclock">✅ All picks are in!</span>`}
        ${last ? `<span class="rd-last-pick">Last pick: #${last.i + 1} ${escHtml(last.p.player)} — ${escHtml(last.p.team)}</span>` : ''}
      </div>`;
    }

    html += '<div class="draft-grid">';
    let lastRound = '';
    picks.forEach((pick, idx) => {
      const pickNum = pick.pick.replace('Pick ', '').replace('Pick', '').trim();
      const roundLabel = pick.round || '';
      if (roundLabel && roundLabel !== lastRound) {
        html += `<div class="round-divider"><span>${roundLabel}</span></div>`;
        lastRound = roundLabel;
      }
      const hasPlayer = pick.player && pick.player !== '' && !pick.player.startsWith('Round');
      const onClockCls = idx === onClockIdx ? ' rd-onclock' : '';
      // The "via" field is stored inconsistently — some picks (mostly older/manually
      // entered ones) already include a leading "via" in the value itself (e.g.
      // "via Brad", or chained trades like "via Jeff via Kyle via Adam/Matt"), while
      // others store just the name. Strip any leading "via" before re-adding exactly
      // one, so a traded pick always shows a single "via X" instead of "via via X".
      const viaText = pick.via ? String(pick.via).replace(/^\s*via\s+/i, '').trim() : '';
      html += `<div class="draft-pick${onClockCls}">
        <div>
          <div class="pick-number">${escHtml(pickNum)}</div>
          <div class="pick-round-tag">#${idx + 1}</div>
        </div>
        <div class="pick-info">
          <div class="pick-player ${hasPlayer ? '' : 'empty'}">${hasPlayer ? escHtml(pick.player) : (idx === onClockIdx ? 'ON THE CLOCK' : 'TBD')}</div>
          <div class="pick-team">${escHtml(pick.team)}</div>
          ${viaText ? `<div class="pick-via">via ${escHtml(viaText)}</div>` : ''}
        </div>
      </div>`;
    });
    html += '</div>';
    contentEl.innerHTML = html;
  }

  tabsEl.querySelectorAll('.year-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      tabsEl.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      window.__draftYearShown = this.dataset.year;
      renderDraft(this.dataset.year);
    });
  });

  if (years.length) { window.__draftYearShown = defaultYear; renderDraft(defaultYear); }
}

// Applies the instant rookie-draft realtime node (live_draft/rookie) into
// LEAGUE_DATA and re-renders the board — runs in EVERY viewer's browser the
// moment the commissioner starts/ends the draft or enters a pick. This is the
// rookie-draft twin of the auction board's live_draft/picks listener.
window.__applyRookieLive = function applyRookieLive() {
  const rl = window.__rookieLive;
  // Always fold the broadcast picks into LEAGUE_DATA (the node is the always-on
  // instant channel, like the auction's live_draft/picks) — the `active` flag only
  // controls whether the red LIVE banner / on-the-clock row is shown.
  if (rl && rl.year && Array.isArray(rl.picks) && rl.picks.length) {
    LEAGUE_DATA.drafts[String(rl.year)] = rl.picks;
  }
  LEAGUE_DATA.liveRookieDraft = (rl && rl.active && rl.year)
    ? { active: true, year: String(rl.year), ts: rl.ts || Date.now() }
    : { active: false };
  // Never disturb the commissioner's rookie-draft edit table while it's open.
  // IMPORTANT: scope this to the draft page only. The live AUCTION page also
  // contains a `.comm-page-editbar` (its draft controls), which is in the DOM for
  // EVERYONE — a bare `.comm-page-editbar` selector matched it for every viewer and
  // silently blocked all rookie-draft redraws (data updated but the board never
  // re-rendered until a manual tab click). That was the core bug.
  if (document.querySelector('#page-draft .comm-page-editbar')) return;
  if (typeof buildDraft === 'function') buildDraft();
};

// ===================== TRADES PAGE =====================
// Per-year line-item groupings derived from the original Master Workbook
// (blank rows there separate the two+ sides of each trade). Stored here in
// code — not in LEAGUE_DATA — so the Firebase blob sync can't overwrite it.
// Each array lists the number of consecutive line items in each trade.
const TRADE_GROUPS = {
  "2019": [2,2,2,2,2,2,2,2,2,2,1,2],
  "2020": [2,2,2,2,2,2,2,2,2,2,2,2,2],
  "2021": [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
  "2022": [2,2,2,2,2,2,2,2,2,2,2,2,2],
  "2023": [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2],
  "2024": [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  "2025": [2,2,2,1,2,2,2,2,2,2,2],
};

function buildTrades() {
  const tabsEl = document.getElementById('trades-year-tabs');
  const contentEl = document.getElementById('trades-content');
  const years = Object.keys(LEAGUE_DATA.trades).sort((a,b) => b-a);

  tabsEl.innerHTML = years.map((yr, i) =>
    `<button class="year-tab ${i === 0 ? 'active' : ''}" data-year="${yr}">${yr}</button>`
  ).join('');

  function renderTrades(year) {
    const trades = LEAGUE_DATA.trades[year] || [];
    if (!trades.length) {
      contentEl.innerHTML = '<div class="empty-state">No trades recorded for this year.</div>';
      return;
    }
    const entryHtml = t => `
        <div class="trade-entry">
          <div class="trade-manager">${escHtml(t.manager || t.managerOriginal)}</div>
          <div class="trade-arrow">received →</div>
          <div class="trade-received">${escHtml(t.received)}</div>
        </div>`;
    // Group consecutive line items per the workbook grouping, with a gap
    // between trades. Any entries beyond the known grouping (e.g. a newly
    // added trade) each render as their own group.
    const sizes = (TRADE_GROUPS[year] || []).slice();
    let html = `<div class="trades-list">`;
    let i = 0;
    if (sizes.length) {
      for (const size of sizes) {
        if (i >= trades.length) break;
        html += `<div class="trade-group">`;
        for (let k = 0; k < size && i < trades.length; k++, i++) html += entryHtml(trades[i]);
        html += `</div>`;
      }
      while (i < trades.length) { html += `<div class="trade-group">${entryHtml(trades[i++])}</div>`; }
    } else {
      html += `<div class="trade-group">${trades.map(entryHtml).join('')}</div>`;
    }
    html += `</div>`;
    contentEl.innerHTML = html;
  }

  tabsEl.querySelectorAll('.year-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      tabsEl.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      renderTrades(this.dataset.year);
    });
  });

  if (years.length) renderTrades(years[0]);
}

// ===================== UTILS =====================
function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===================== INIT =====================

// ===================== WRITE UPS PAGE =====================


function buildWriteUps() {
  const tabsEl = document.getElementById('writeups-year-tabs');
  const contentEl = document.getElementById('writeups-content');
  
  // Group by year
  const byYear = {};
  WRITEUP_SECTIONS.forEach(s => {
    if (!byYear[s.year]) byYear[s.year] = [];
    byYear[s.year].push(s);
  });
  
  const years = Object.keys(byYear).sort((a,b) => b-a);
  
  // Year tabs
  tabsEl.innerHTML = years.map((yr, i) =>
    `<button class="year-tab ${i===0?'active':''}" data-year="${yr}">${yr}</button>`
  ).join('');
  
  function renderYear(year) {
    const sections = byYear[year] || [];
    
    // If multiple sections for a year, show sub-tabs
    let html = '<div class="wu-article">';
    
    if (sections.length > 1) {
      html += '<div class="wu-sub-tabs" id="wu-sub-tabs">';
      sections.forEach((s, i) => {
        html += `<button class="wu-sub-tab ${i===0?'active':''}" data-idx="${i}">${s.title}</button>`;
      });
      html += '</div>';
    }
    
    sections.forEach((s, i) => {
      html += `<div class="wu-section ${i===0?'active':''}" data-idx="${i}">${s.html}</div>`;
    });
    
    html += '</div>';
    contentEl.innerHTML = html;
    
    // Sub-tab click handling
    contentEl.querySelectorAll('.wu-sub-tab').forEach(tab => {
      tab.addEventListener('click', function() {
        const idx = this.dataset.idx;
        contentEl.querySelectorAll('.wu-sub-tab').forEach(t => t.classList.remove('active'));
        contentEl.querySelectorAll('.wu-section').forEach(s => s.classList.remove('active'));
        this.classList.add('active');
        contentEl.querySelector(`.wu-section[data-idx="${idx}"]`).classList.add('active');
        contentEl.querySelector('.wu-article').scrollIntoView({behavior:'smooth', block:'start'});
      });
    });
  }
  
  tabsEl.querySelectorAll('.year-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      tabsEl.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      renderYear(this.dataset.year);
    });
  });
  
  if (years.length) renderYear(years[0]);
}

// ===================== HISTORY PAGE =====================
const HISTORY_DATA = {"years":[2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025],"currentOwners":["Adam Banchiu","Blake Keaton","Bob Willen","Brad White","Braden Geraldo","Campbell Gillespie","Casey Smith","Collin Frink","James Laethem","Jeff Butler","Kyle Chorazyczewski","Michael Costello"],"seasons":{"2011":{"teams":[{"tid":1,"name":"Stafford  and Son","abbrev":"CHEW","w":6,"l":7,"t":0,"pf":1074,"pa":1205,"finalRank":9,"seed":7,"owner":"Adam Banchiu","madePlayoffs":false},{"tid":2,"name":"Team Butler","abbrev":"BUTL","w":3,"l":10,"t":0,"pf":958,"pa":1212,"finalRank":10,"seed":10,"owner":"Jeff Butler","madePlayoffs":false},{"tid":3,"name":"Team Miller","abbrev":"MILL","w":9,"l":4,"t":0,"pf":1286,"pa":1037,"finalRank":3,"seed":2,"owner":"Dan Miller","madePlayoffs":true},{"tid":4,"name":"All Hail The King","abbrev":"CPS","w":6,"l":7,"t":0,"pf":1134,"pa":1194,"finalRank":6,"seed":6,"owner":"Casey Smith","madePlayoffs":false},{"tid":5,"name":"Winner's Mentality","abbrev":"WIN","w":4,"l":9,"t":0,"pf":1012,"pa":1162,"finalRank":7,"seed":9,"owner":"Braden Geraldo","madePlayoffs":false},{"tid":6,"name":"Team Keaton","abbrev":"KEAT","w":7,"l":6,"t":0,"pf":1213,"pa":1192,"finalRank":8,"seed":5,"owner":"Blake Keaton","madePlayoffs":false},{"tid":7,"name":"Upper Deckers","abbrev":"WILB","w":5,"l":8,"t":0,"pf":1219,"pa":1261,"finalRank":5,"seed":8,"owner":"Kevin Wilberding","madePlayoffs":false},{"tid":8,"name":"Its on like Ndamukong","abbrev":"SUH","w":9,"l":4,"t":0,"pf":1466,"pa":1207,"finalRank":1,"seed":1,"owner":"Brad White","madePlayoffs":true},{"tid":9,"name":"Team Carpenter","abbrev":"HANK","w":9,"l":4,"t":0,"pf":1194,"pa":1195,"finalRank":2,"seed":3,"owner":"Hank Carpenter","madePlayoffs":true},{"tid":10,"name":"Upper West Side Schmucks","abbrev":"JAYG","w":7,"l":6,"t":0,"pf":1216,"pa":1107,"finalRank":4,"seed":4,"owner":"Jay Gersonde","madePlayoffs":true}],"leagueName":"MSU Fantasy Football League"},"2012":{"teams":[{"tid":1,"name":"Fig Newtons","abbrev":"CHEW","w":8,"l":5,"t":0,"pf":1185,"pa":1209,"finalRank":6,"seed":5,"owner":"Adam Banchiu","madePlayoffs":false},{"tid":2,"name":"The Replacements","abbrev":"TR","w":5,"l":8,"t":0,"pf":1101,"pa":1173,"finalRank":5,"seed":8,"owner":"Jeff Butler","madePlayoffs":false},{"tid":3,"name":"Stewart Scott's Glass Eye","abbrev":"EYE","w":10,"l":3,"t":0,"pf":1306,"pa":1100,"finalRank":4,"seed":1,"owner":"Campbell Gillespie","madePlayoffs":true},{"tid":4,"name":"My Jim Schwartz Are Dirty","abbrev":"CPS","w":6,"l":7,"t":0,"pf":1158,"pa":1102,"finalRank":7,"seed":6,"owner":"Casey Smith","madePlayoffs":false},{"tid":5,"name":"Show Me Your TDs","abbrev":"TITS","w":8,"l":5,"t":0,"pf":1228,"pa":1067,"finalRank":1,"seed":3,"owner":"Braden Geraldo","madePlayoffs":true},{"tid":6,"name":"Plaxidental Shooting","abbrev":"Plax","w":8,"l":5,"t":0,"pf":1195,"pa":1014,"finalRank":3,"seed":2,"owner":"Blake Keaton","madePlayoffs":true},{"tid":7,"name":"Asian Carp","abbrev":"ASS","w":3,"l":10,"t":0,"pf":886,"pa":1117,"finalRank":8,"seed":10,"owner":"Kevin Wilberding","madePlayoffs":false},{"tid":8,"name":"Its on like Ndamukong","abbrev":"SUH","w":8,"l":5,"t":0,"pf":1138,"pa":1029,"finalRank":2,"seed":4,"owner":"Brad White","madePlayoffs":true},{"tid":9,"name":"Team Carpenter","abbrev":"HANK","w":3,"l":10,"t":0,"pf":844,"pa":1183,"finalRank":10,"seed":9,"owner":"Hank Carpenter","madePlayoffs":false},{"tid":10,"name":"No Suh For You!","abbrev":"JAYG","w":6,"l":7,"t":0,"pf":995,"pa":1042,"finalRank":9,"seed":7,"owner":"Jay Gersonde","madePlayoffs":false}],"leagueName":"MSU Fantasy Football League"},"2013":{"teams":[{"tid":1,"name":"Kaep n\u00e2\u0080\u0099 Crunch","abbrev":"CHEW","w":9,"l":4,"t":0,"pf":1222,"pa":1098,"finalRank":4,"seed":3,"owner":"Adam Banchiu","madePlayoffs":true},{"tid":2,"name":"The Replacements","abbrev":"TR","w":3,"l":10,"t":0,"pf":1092,"pa":1203,"finalRank":10,"seed":9,"owner":"Jeff Butler","madePlayoffs":false},{"tid":3,"name":"Stewart Scott's Glass Eye","abbrev":"EYE","w":4,"l":9,"t":0,"pf":1076,"pa":1340,"finalRank":6,"seed":8,"owner":"Campbell Gillespie","madePlayoffs":false},{"tid":4,"name":"My Jim Schwartz Are Dirty","abbrev":"CPS","w":9,"l":4,"t":0,"pf":1156,"pa":1105,"finalRank":3,"seed":4,"owner":"Casey Smith","madePlayoffs":true},{"tid":5,"name":"Show Me Your TDs","abbrev":"TITS","w":10,"l":3,"t":0,"pf":1478,"pa":1092,"finalRank":1,"seed":1,"owner":"Braden Geraldo","madePlayoffs":true},{"tid":6,"name":"Plaxidental Shooting","abbrev":"Plax","w":9,"l":4,"t":0,"pf":1285,"pa":1209,"finalRank":2,"seed":2,"owner":"Blake Keaton","madePlayoffs":true},{"tid":7,"name":"Asian Carp","abbrev":"ASS","w":7,"l":6,"t":0,"pf":1162,"pa":1263,"finalRank":7,"seed":6,"owner":"Matthew Currier","madePlayoffs":false},{"tid":8,"name":"Its on like Ndamukong","abbrev":"SUH","w":5,"l":8,"t":0,"pf":1045,"pa":1087,"finalRank":9,"seed":7,"owner":"Brad White","madePlayoffs":false},{"tid":9,"name":"The Commish","abbrev":"COS","w":2,"l":11,"t":0,"pf":973,"pa":1225,"finalRank":8,"seed":10,"owner":"Michael Costello","madePlayoffs":false},{"tid":10,"name":"Welker? Barely Knew Her","abbrev":"WELK","w":7,"l":6,"t":0,"pf":1236,"pa":1103,"finalRank":5,"seed":5,"owner":"Collin Frink","madePlayoffs":false}],"leagueName":"MSU Fantasy Football League"},"2014":{"teams":[{"tid":1,"name":"Smokin' Jays","abbrev":"CHEW","w":4,"l":9,"t":0,"pf":874,"pa":1168,"finalRank":10,"seed":9,"owner":"Adam Banchiu","madePlayoffs":false},{"tid":2,"name":"The Replacements","abbrev":"TR","w":3,"l":10,"t":0,"pf":1014,"pa":1219,"finalRank":8,"seed":10,"owner":"Jeff Butler","madePlayoffs":false},{"tid":3,"name":"San Francisco  69ers","abbrev":"69","w":9,"l":4,"t":0,"pf":1385,"pa":1113,"finalRank":3,"seed":1,"owner":"Campbell Gillespie","madePlayoffs":true},{"tid":4,"name":"Ray Rice Elevator Co.","abbrev":"CPS","w":5,"l":8,"t":0,"pf":1056,"pa":1197,"finalRank":9,"seed":7,"owner":"Casey Smith","madePlayoffs":false},{"tid":5,"name":"Show Me Your TDs","abbrev":"TITS","w":6,"l":7,"t":0,"pf":1241,"pa":1269,"finalRank":6,"seed":6,"owner":"Braden Geraldo","madePlayoffs":false},{"tid":6,"name":"Plaxidental Shooting","abbrev":"Plax","w":5,"l":8,"t":0,"pf":1153,"pa":1201,"finalRank":5,"seed":8,"owner":"Blake Keaton","madePlayoffs":false},{"tid":7,"name":"Asian Carp","abbrev":"ASS","w":7,"l":6,"t":0,"pf":1339,"pa":1310,"finalRank":7,"seed":5,"owner":"Matthew Currier","madePlayoffs":false},{"tid":8,"name":"Its on like Ndamukong","abbrev":"SUH","w":9,"l":4,"t":0,"pf":1244,"pa":1186,"finalRank":1,"seed":2,"owner":"Brad White","madePlayoffs":true},{"tid":9,"name":"The Commish","abbrev":"COS","w":8,"l":5,"t":0,"pf":1182,"pa":990,"finalRank":2,"seed":4,"owner":"Michael Costello","madePlayoffs":true},{"tid":10,"name":"Edward Forte Hands","abbrev":"40oz","w":9,"l":4,"t":0,"pf":1216,"pa":1051,"finalRank":4,"seed":3,"owner":"Collin Frink","madePlayoffs":true}],"leagueName":"MSU Fantasy Football League"},"2015":{"teams":[{"tid":1,"name":"Waddams Staplers","abbrev":"CHEW","w":7,"l":6,"t":0,"pf":1245.5,"pa":1142.2,"finalRank":3,"seed":5,"owner":"Adam Banchiu","madePlayoffs":true},{"tid":2,"name":"The Replacements","abbrev":"TR","w":6,"l":7,"t":0,"pf":1134.5,"pa":1128.2,"finalRank":7,"seed":7,"owner":"Jeff Butler","madePlayoffs":false},{"tid":3,"name":"San Francisco  69ers","abbrev":"69","w":5,"l":8,"t":0,"pf":1198.9,"pa":1419.7,"finalRank":11,"seed":9,"owner":"Campbell Gillespie","madePlayoffs":false},{"tid":4,"name":"Ray Rice Elevator Co.","abbrev":"CPS","w":10,"l":3,"t":0,"pf":1399.7,"pa":1173.4,"finalRank":1,"seed":1,"owner":"Casey Smith","madePlayoffs":true},{"tid":5,"name":"Show Me Your TDs","abbrev":"TITS","w":8,"l":5,"t":0,"pf":1248.2,"pa":1114.6,"finalRank":4,"seed":3,"owner":"Braden Geraldo","madePlayoffs":true},{"tid":6,"name":"Plaxidental Shooting","abbrev":"Plax","w":9,"l":4,"t":0,"pf":1224.8,"pa":1048.3,"finalRank":6,"seed":4,"owner":"Blake Keaton","madePlayoffs":true},{"tid":7,"name":"Ron Mexico","abbrev":"RM","w":2,"l":11,"t":0,"pf":947.8,"pa":1256.7,"finalRank":12,"seed":12,"owner":"Matthew Currier","madePlayoffs":false},{"tid":8,"name":"Its on like Ndamukong","abbrev":"SUH","w":10,"l":3,"t":0,"pf":1366.9,"pa":1143.0,"finalRank":2,"seed":2,"owner":"Brad White","madePlayoffs":true},{"tid":9,"name":"Team of Deztiny","abbrev":"COS","w":6,"l":7,"t":0,"pf":1103.5,"pa":1159.0,"finalRank":8,"seed":8,"owner":"Michael Costello","madePlayoffs":false},{"tid":10,"name":"Detroit Lions","abbrev":"0-16","w":3,"l":10,"t":0,"pf":977.7,"pa":1251.2,"finalRank":10,"seed":11,"owner":"Collin Frink","madePlayoffs":false},{"tid":11,"name":"Stein's  Superstars Pt 2","abbrev":"MJS","w":5,"l":8,"t":0,"pf":1143.7,"pa":1171.4,"finalRank":9,"seed":10,"owner":"Matt Steinmetz","madePlayoffs":false},{"tid":12,"name":"Team Bad Boys","abbrev":"BB","w":7,"l":6,"t":0,"pf":1241.5,"pa":1225.2,"finalRank":5,"seed":6,"owner":"Kyle Chorazyczewski","madePlayoffs":true}],"leagueName":"MSU Fantasy Football League"},"2016":{"teams":[{"tid":1,"name":"Waddams Staplers","abbrev":"CHEW","w":5,"l":8,"t":0,"pf":1246.5,"pa":1414.8,"finalRank":9,"seed":9,"owner":"Adam Banchiu","madePlayoffs":false},{"tid":2,"name":"The Replacements","abbrev":"TR","w":5,"l":8,"t":0,"pf":1253.8,"pa":1372.6,"finalRank":12,"seed":8,"owner":"Jeff Butler","madePlayoffs":false},{"tid":3,"name":"San Francisco  69ers","abbrev":"69","w":5,"l":8,"t":0,"pf":1244.8,"pa":1466.0,"finalRank":7,"seed":10,"owner":"Campbell Gillespie","madePlayoffs":false},{"tid":4,"name":"The Ansah","abbrev":"CPS","w":13,"l":0,"t":0,"pf":1743.7,"pa":1290.2,"finalRank":1,"seed":1,"owner":"Casey Smith","madePlayoffs":true},{"tid":5,"name":"Show Me Your TDs","abbrev":"TITS","w":10,"l":3,"t":0,"pf":1500.2,"pa":1311.3,"finalRank":2,"seed":2,"owner":"Braden Geraldo","madePlayoffs":true},{"tid":6,"name":"Jim Bob Keater","abbrev":"Cunt","w":5,"l":8,"t":0,"pf":1299.7,"pa":1344.3,"finalRank":10,"seed":7,"owner":"Blake Keaton","madePlayoffs":false},{"tid":7,"name":"Does all my yard work","abbrev":"MEX","w":3,"l":10,"t":0,"pf":1300.7,"pa":1454.4,"finalRank":11,"seed":12,"owner":"Matthew Currier","madePlayoffs":false},{"tid":8,"name":"Its on like Ndamukong","abbrev":"SUH","w":8,"l":5,"t":0,"pf":1351.3,"pa":1287.3,"finalRank":3,"seed":3,"owner":"Brad White","madePlayoffs":true},{"tid":9,"name":"Team of Deztiny","abbrev":"COS","w":6,"l":7,"t":0,"pf":1348.2,"pa":1353.9,"finalRank":5,"seed":6,"owner":"Michael Costello","madePlayoffs":true},{"tid":10,"name":"Team Frink","abbrev":"BJNM","w":5,"l":8,"t":0,"pf":1239.1,"pa":1289.5,"finalRank":8,"seed":11,"owner":"Collin Frink","madePlayoffs":false},{"tid":11,"name":"Drunkin Polaks","abbrev":"POL","w":6,"l":7,"t":0,"pf":1444.5,"pa":1354.3,"finalRank":4,"seed":5,"owner":"Kyle Chorazyczewski","madePlayoffs":true},{"tid":12,"name":"Team Laethem","abbrev":"JL","w":7,"l":6,"t":0,"pf":1347.0,"pa":1380.7,"finalRank":6,"seed":4,"owner":"James Laethem","madePlayoffs":true}],"leagueName":"MSU Fantasy Football League"},"2017":{"teams":[{"tid":1,"name":"Waddams Staplers","abbrev":"CHEW","w":6,"l":7,"t":0,"pf":1196.4,"pa":1352.4,"finalRank":7,"seed":8,"owner":"Adam Banchiu","madePlayoffs":false},{"tid":2,"name":"The Replacements","abbrev":"TR","w":6,"l":7,"t":0,"pf":1216.0,"pa":1214.8,"finalRank":8,"seed":7,"owner":"Jeff Butler","madePlayoffs":false},{"tid":3,"name":"San Francisco  69ers","abbrev":"69","w":3,"l":10,"t":0,"pf":1184.4,"pa":1416.1,"finalRank":12,"seed":12,"owner":"Campbell Gillespie","madePlayoffs":false},{"tid":4,"name":"The Ansah","abbrev":"CPS","w":7,"l":6,"t":0,"pf":1375.6,"pa":1226.0,"finalRank":5,"seed":4,"owner":"Casey Smith","madePlayoffs":true},{"tid":5,"name":"Show Me Your TDs","abbrev":"TITS","w":9,"l":4,"t":0,"pf":1450.3,"pa":1321.2,"finalRank":2,"seed":3,"owner":"Braden Geraldo","madePlayoffs":true},{"tid":6,"name":"Jim Bob Keater","abbrev":"Cunt","w":4,"l":9,"t":0,"pf":1160.5,"pa":1330.7,"finalRank":11,"seed":11,"owner":"Blake Keaton","madePlayoffs":false},{"tid":7,"name":"You are  all sheep","abbrev":"BAH","w":10,"l":3,"t":0,"pf":1399.5,"pa":1159.2,"finalRank":4,"seed":2,"owner":"Scott Simon","madePlayoffs":true},{"tid":8,"name":"What Can Brown Do For You?","abbrev":"UPS","w":7,"l":6,"t":0,"pf":1247.4,"pa":1265.8,"finalRank":3,"seed":5,"owner":"Brad White","madePlayoffs":true},{"tid":9,"name":"Team of Deztiny","abbrev":"COS","w":5,"l":8,"t":0,"pf":1228.9,"pa":1399.4,"finalRank":10,"seed":9,"owner":"Michael Costello","madePlayoffs":false},{"tid":10,"name":"Stairway To Evans","abbrev":"BJNM","w":5,"l":8,"t":0,"pf":1169.6,"pa":1225.1,"finalRank":9,"seed":10,"owner":"Collin Frink","madePlayoffs":false},{"tid":11,"name":"Drunkin Polaks","abbrev":"POL","w":6,"l":7,"t":0,"pf":1267.1,"pa":1288.8,"finalRank":6,"seed":6,"owner":"Kyle Chorazyczewski","madePlayoffs":true},{"tid":12,"name":"The Mixon Administration","abbrev":"JL","w":10,"l":3,"t":0,"pf":1491.3,"pa":1187.4,"finalRank":1,"seed":1,"owner":"James Laethem","madePlayoffs":true}],"leagueName":"MSU Fantasy Football League"},"2018":{"teams":[{"tid":1,"name":"Lets Cook","abbrev":"COOK","w":9,"l":4,"t":0,"pf":1438.0,"pa":1359.8,"finalRank":6,"seed":3,"owner":"Adam Banchiu","madePlayoffs":true},{"tid":2,"name":"Thielen  Myself","abbrev":"TM","w":4,"l":9,"t":0,"pf":1441.2,"pa":1460.8,"finalRank":9,"seed":9,"owner":"Jeff Butler","madePlayoffs":false},{"tid":3,"name":"San Francisco  69ers","abbrev":"69","w":9,"l":4,"t":0,"pf":1446.3,"pa":1244.0,"finalRank":5,"seed":4,"owner":"Campbell Gillespie","madePlayoffs":true},{"tid":4,"name":"Me and Ma Homies","abbrev":"CPS","w":10,"l":3,"t":0,"pf":1656.5,"pa":1341.6,"finalRank":2,"seed":1,"owner":"Casey Smith","madePlayoffs":true},{"tid":5,"name":"Show Me Your TDs","abbrev":"TITS","w":8,"l":5,"t":0,"pf":1704.5,"pa":1379.6,"finalRank":4,"seed":5,"owner":"Braden Geraldo","madePlayoffs":true},{"tid":6,"name":"Jim Bob Keater","abbrev":"Cunt","w":3,"l":10,"t":0,"pf":1078.2,"pa":1289.5,"finalRank":8,"seed":11,"owner":"Blake Keaton","madePlayoffs":false},{"tid":7,"name":"Blake Bortles Wikipedia Club","abbrev":"BOAT","w":4,"l":9,"t":0,"pf":1206.0,"pa":1416.9,"finalRank":11,"seed":10,"owner":"Scott Simon","madePlayoffs":false},{"tid":8,"name":"What Can Brown Do For You?","abbrev":"UPS","w":6,"l":7,"t":0,"pf":1396.7,"pa":1415,"finalRank":7,"seed":8,"owner":"Brad White","madePlayoffs":false},{"tid":9,"name":"Half Chubb","abbrev":"COS","w":0,"l":13,"t":0,"pf":570.2,"pa":1575.2,"finalRank":10,"seed":12,"owner":"Michael Costello","madePlayoffs":false},{"tid":10,"name":"JuulJuul Smith Schuster","abbrev":"BJNM","w":8,"l":5,"t":0,"pf":1443.9,"pa":1406.6,"finalRank":12,"seed":7,"owner":"Collin Frink","madePlayoffs":false},{"tid":11,"name":"Drunkin Polaks","abbrev":"POL","w":8,"l":5,"t":0,"pf":1566.9,"pa":1323.4,"finalRank":3,"seed":6,"owner":"Kyle Chorazyczewski","madePlayoffs":true},{"tid":12,"name":"The Mixon Administration","abbrev":"JL","w":9,"l":4,"t":0,"pf":1584.1,"pa":1319.8,"finalRank":1,"seed":2,"owner":"James Laethem","madePlayoffs":true}],"leagueName":"MSU Fantasy Football League"},"2019":{"teams":[{"tid":1,"name":"Lets Cook","abbrev":"COOK","w":7,"l":6,"t":0,"pf":1439.1,"pa":1334.4,"finalRank":5,"seed":5,"owner":"Adam Banchiu","madePlayoffs":true},{"tid":2,"name":"Thielen  That OtpBJ","abbrev":"TM","w":6,"l":7,"t":0,"pf":1282.0,"pa":1425.5,"finalRank":7,"seed":7,"owner":"Jeff Butler","madePlayoffs":false},{"tid":3,"name":"San Francisco  69ers","abbrev":"69","w":10,"l":3,"t":0,"pf":1473.7,"pa":1352.2,"finalRank":2,"seed":2,"owner":"Campbell Gillespie","madePlayoffs":true},{"tid":4,"name":"Me and Ma Homies","abbrev":"CPS","w":5,"l":8,"t":0,"pf":1167.9,"pa":1402.7,"finalRank":8,"seed":10,"owner":"Casey Smith","madePlayoffs":false},{"tid":5,"name":"Show Me Your TDs","abbrev":"TITS","w":8,"l":5,"t":0,"pf":1397.4,"pa":1309.8,"finalRank":1,"seed":4,"owner":"Braden Geraldo","madePlayoffs":true},{"tid":6,"name":"Jim Bob Keater","abbrev":"Cunt","w":7,"l":6,"t":0,"pf":1323.5,"pa":1284.7,"finalRank":6,"seed":3,"owner":"Blake Keaton","madePlayoffs":true},{"tid":7,"name":"Blake Bortles Wikipedia Club","abbrev":"BOAT","w":5,"l":8,"t":0,"pf":1240.1,"pa":1372.4,"finalRank":11,"seed":9,"owner":"Scott Simon","madePlayoffs":false},{"tid":8,"name":"Derr-lick my Henry Balls","abbrev":"Zoo","w":4,"l":9,"t":0,"pf":1388.8,"pa":1491.5,"finalRank":12,"seed":11,"owner":"Brad White","madePlayoffs":false},{"tid":9,"name":"Half Chubb","abbrev":"COS","w":5,"l":8,"t":0,"pf":1419.8,"pa":1363.3,"finalRank":10,"seed":8,"owner":"Michael Costello","madePlayoffs":false},{"tid":10,"name":"Will Lutz RB1","abbrev":"BJNM","w":4,"l":9,"t":0,"pf":1207.1,"pa":1321.7,"finalRank":9,"seed":12,"owner":"Collin Frink","madePlayoffs":false},{"tid":11,"name":"Drunkin Polaks","abbrev":"POL","w":11,"l":2,"t":0,"pf":1482.0,"pa":1248.3,"finalRank":3,"seed":1,"owner":"Kyle Chorazyczewski","madePlayoffs":true},{"tid":12,"name":"The Mixon Administration","abbrev":"JL","w":6,"l":7,"t":0,"pf":1412.6,"pa":1327.8,"finalRank":4,"seed":6,"owner":"James Laethem","madePlayoffs":true}],"leagueName":"MSU Fantasy Football League"},"2020":{"teams":[{"tid":1,"name":"Lets Cook","abbrev":"COOK","w":4,"l":9,"t":0,"pf":1092.5,"pa":1338.2,"finalRank":11,"seed":12,"owner":"Adam Banchiu","madePlayoffs":false},{"tid":2,"name":"Thielen  Mosthurt","abbrev":"TM","w":5,"l":8,"t":0,"pf":1243.8,"pa":1402.7,"finalRank":9,"seed":9,"owner":"Jeff Butler","madePlayoffs":false},{"tid":3,"name":"San Francisco  69ers","abbrev":"69","w":7,"l":6,"t":0,"pf":1285.8,"pa":1260.6,"finalRank":4,"seed":6,"owner":"Campbell Gillespie","madePlayoffs":true},{"tid":4,"name":"Me and Ma Homies","abbrev":"CPS","w":9,"l":4,"t":0,"pf":1380.7,"pa":1271.8,"finalRank":5,"seed":3,"owner":"Casey Smith","madePlayoffs":true},{"tid":5,"name":"Show Me Your TDs","abbrev":"TITS","w":9,"l":4,"t":0,"pf":1560.3,"pa":1394.8,"finalRank":2,"seed":2,"owner":"Braden Geraldo","madePlayoffs":true},{"tid":6,"name":"CeeDees D.K.","abbrev":"DicK","w":7,"l":6,"t":0,"pf":1405.4,"pa":1407.5,"finalRank":3,"seed":5,"owner":"Blake Keaton","madePlayoffs":true},{"tid":7,"name":"Blake Bortles Wikipedia Club","abbrev":"BOAT","w":4,"l":9,"t":0,"pf":1254.0,"pa":1401.7,"finalRank":10,"seed":11,"owner":"Scott Simon","madePlayoffs":false},{"tid":8,"name":"Derr-lick my Henry Balls","abbrev":"Zoo","w":10,"l":3,"t":0,"pf":1630.3,"pa":1328.8,"finalRank":1,"seed":1,"owner":"Brad White","madePlayoffs":true},{"tid":9,"name":"Half Chubb","abbrev":"COS","w":5,"l":8,"t":0,"pf":1498.2,"pa":1463.0,"finalRank":8,"seed":7,"owner":"Michael Costello","madePlayoffs":false},{"tid":10,"name":"Smith-Schuster? Barely Know Her","abbrev":"BJNM","w":9,"l":4,"t":0,"pf":1349.7,"pa":1253.7,"finalRank":6,"seed":4,"owner":"Collin Frink","madePlayoffs":true},{"tid":11,"name":"Drunkin Polaks","abbrev":"POL","w":4,"l":9,"t":0,"pf":1389.6,"pa":1417.9,"finalRank":12,"seed":10,"owner":"Kyle Chorazyczewski","madePlayoffs":false},{"tid":12,"name":"The Mixon Administration","abbrev":"JL","w":5,"l":8,"t":0,"pf":1449.3,"pa":1598.9,"finalRank":7,"seed":8,"owner":"James Laethem","madePlayoffs":false}],"leagueName":"MSU Fantasy Football League"},"2021":{"teams":[{"tid":1,"name":"Lets Cook","abbrev":"COOK","w":10,"l":4,"t":0,"pf":1713.6,"pa":1342.7,"finalRank":1,"seed":2,"owner":"Adam Banchiu","madePlayoffs":true},{"tid":2,"name":"My Little  Toney","abbrev":"TM","w":1,"l":13,"t":0,"pf":792.9,"pa":1407.4,"finalRank":12,"seed":12,"owner":"Jeff Butler","madePlayoffs":false},{"tid":3,"name":"Windy City  Waterboys","abbrev":"WCW","w":3,"l":11,"t":0,"pf":1076,"pa":1444.2,"finalRank":11,"seed":11,"owner":"Campbell Gillespie","madePlayoffs":false},{"tid":4,"name":"Me and Ma Homies","abbrev":"CPS","w":6,"l":8,"t":0,"pf":1338.6,"pa":1550.6,"finalRank":9,"seed":9,"owner":"Casey Smith","madePlayoffs":false},{"tid":5,"name":"Show Me Your TDs","abbrev":"TITS","w":9,"l":5,"t":0,"pf":1607.8,"pa":1479.5,"finalRank":6,"seed":4,"owner":"Braden Geraldo","madePlayoffs":true},{"tid":6,"name":"CeeDees D.K.","abbrev":"DicK","w":8,"l":6,"t":0,"pf":1529.2,"pa":1438.5,"finalRank":2,"seed":5,"owner":"Blake Keaton","madePlayoffs":true},{"tid":7,"name":"Blake Bortles Wikipedia Club","abbrev":"BOAT","w":4,"l":10,"t":0,"pf":1199.0,"pa":1528.7,"finalRank":10,"seed":10,"owner":"Scott Simon","madePlayoffs":false},{"tid":8,"name":"Derr-lick my Henry Balls","abbrev":"Zoo","w":14,"l":0,"t":0,"pf":1782.2,"pa":1230.4,"finalRank":3,"seed":1,"owner":"Brad White","madePlayoffs":true},{"tid":9,"name":"Chasing Dimes","abbrev":"COS","w":8,"l":6,"t":0,"pf":1418.1,"pa":1354.2,"finalRank":5,"seed":6,"owner":"Michael Costello","madePlayoffs":true},{"tid":10,"name":"Smith-Schuster? Barely Know Her","abbrev":"BJNM","w":6,"l":8,"t":0,"pf":1370.0,"pa":1349.7,"finalRank":7,"seed":8,"owner":"Collin Frink","madePlayoffs":false},{"tid":11,"name":"Drunkin Polaks","abbrev":"POL","w":8,"l":6,"t":0,"pf":1639.9,"pa":1466.8,"finalRank":4,"seed":3,"owner":"Kyle Chorazyczewski","madePlayoffs":true},{"tid":12,"name":"The Mixon Administration","abbrev":"JL","w":7,"l":7,"t":0,"pf":1494.3,"pa":1368.9,"finalRank":8,"seed":7,"owner":"James Laethem","madePlayoffs":false}],"leagueName":"MSU Fantasy Football League"},"2022":{"teams":[{"tid":1,"name":"Lets Cook","abbrev":"COOK","w":10,"l":4,"t":0,"pf":1480.3,"pa":1336.6,"finalRank":2,"seed":2,"owner":"Adam Banchiu","madePlayoffs":true},{"tid":2,"name":"Breece's Pierces","abbrev":"BP","w":7,"l":7,"t":0,"pf":1264,"pa":1371.3,"finalRank":10,"seed":7,"owner":"Jeff Butler","madePlayoffs":false},{"tid":3,"name":"Windy City  Waterboys","abbrev":"WCW","w":4,"l":10,"t":0,"pf":1228.9,"pa":1533.9,"finalRank":11,"seed":11,"owner":"Campbell Gillespie","madePlayoffs":false},{"tid":4,"name":"Me and Mah Homies","abbrev":"CPS","w":9,"l":5,"t":0,"pf":1391.5,"pa":1304.5,"finalRank":5,"seed":4,"owner":"Casey Smith","madePlayoffs":true},{"tid":5,"name":"Show Me Your TDs","abbrev":"TITS","w":8,"l":6,"t":0,"pf":1688.7,"pa":1478.0,"finalRank":4,"seed":5,"owner":"Braden Geraldo","madePlayoffs":true},{"tid":6,"name":"Patrick Bateman's","abbrev":"BK","w":5,"l":9,"t":0,"pf":1413.3,"pa":1473.3,"finalRank":8,"seed":10,"owner":"Blake Keaton","madePlayoffs":false},{"tid":7,"name":"There's a YOU  Sheriff in Town","abbrev":"YOU!","w":2,"l":12,"t":0,"pf":1137.6,"pa":1496.2,"finalRank":7,"seed":12,"owner":"Bob Willen","madePlayoffs":false},{"tid":8,"name":"What Can Brown Do For You?","abbrev":"UPS","w":11,"l":3,"t":0,"pf":1690.1,"pa":1406.3,"finalRank":1,"seed":1,"owner":"Brad White","madePlayoffs":true},{"tid":9,"name":"Ch\u2022ubb\u2022y Chaser","abbrev":"COS","w":9,"l":5,"t":0,"pf":1613.1,"pa":1397,"finalRank":3,"seed":3,"owner":"Michael Costello","madePlayoffs":true},{"tid":10,"name":"Burrow Mckokiner","abbrev":"BJNM","w":6,"l":8,"t":0,"pf":1325.4,"pa":1479.3,"finalRank":9,"seed":9,"owner":"Collin Frink","madePlayoffs":false},{"tid":11,"name":"Drunkin Polaks","abbrev":"POL","w":6,"l":8,"t":0,"pf":1393.2,"pa":1433.6,"finalRank":12,"seed":8,"owner":"Kyle Chorazyczewski","madePlayoffs":false},{"tid":12,"name":"The Mixon Administration","abbrev":"JL","w":7,"l":7,"t":0,"pf":1407.5,"pa":1323.6,"finalRank":6,"seed":6,"owner":"James Laethem","madePlayoffs":true}],"leagueName":"MSU Fantasy Football League"},"2023":{"teams":[{"tid":1,"name":"Lets Cook","abbrev":"COOK","w":6,"l":8,"t":0,"pf":1433.1,"pa":1430.0,"finalRank":7,"seed":9,"owner":"Adam Banchiu","madePlayoffs":false},{"tid":2,"name":"Breece's Pierces","abbrev":"BP","w":4,"l":10,"t":0,"pf":1297.8,"pa":1463.0,"finalRank":8,"seed":11,"owner":"Jeff Butler","madePlayoffs":false},{"tid":3,"name":"Windy City Waterboys","abbrev":"WCW","w":9,"l":5,"t":0,"pf":1594.3,"pa":1559.3,"finalRank":4,"seed":3,"owner":"Campbell Gillespie","madePlayoffs":true},{"tid":4,"name":"The Benchwarmers","abbrev":"CPS","w":4,"l":10,"t":0,"pf":1193.3,"pa":1401.2,"finalRank":12,"seed":12,"owner":"Casey Smith","madePlayoffs":false},{"tid":5,"name":"Show Me Your TDs","abbrev":"TITS","w":7,"l":7,"t":0,"pf":1530.1,"pa":1437.1,"finalRank":6,"seed":5,"owner":"Braden Geraldo","madePlayoffs":true},{"tid":6,"name":"Two Wilsons one Kupp","abbrev":"BK","w":9,"l":5,"t":0,"pf":1686.8,"pa":1422.4,"finalRank":1,"seed":2,"owner":"Blake Keaton","madePlayoffs":true},{"tid":7,"name":"There's a YOU Sheriff in Town","abbrev":"YOU!","w":10,"l":4,"t":0,"pf":1515.4,"pa":1295.1,"finalRank":3,"seed":1,"owner":"Bob Willen","madePlayoffs":true},{"tid":8,"name":"What Can Brown Do For You?","abbrev":"UPS","w":7,"l":7,"t":0,"pf":1498.7,"pa":1563.7,"finalRank":5,"seed":6,"owner":"Brad White","madePlayoffs":true},{"tid":9,"name":"Chasing Dimes","abbrev":"COS","w":9,"l":5,"t":0,"pf":1557.8,"pa":1431.9,"finalRank":2,"seed":4,"owner":"Michael Costello","madePlayoffs":true},{"tid":10,"name":"Burrow Mckokiner","abbrev":"BJNM","w":5,"l":9,"t":0,"pf":1286.2,"pa":1441.3,"finalRank":9,"seed":10,"owner":"Collin Frink","madePlayoffs":false},{"tid":11,"name":"Drunkin Polaks","abbrev":"POL","w":7,"l":7,"t":0,"pf":1383.7,"pa":1499.9,"finalRank":10,"seed":8,"owner":"Kyle Chorazyczewski","madePlayoffs":false},{"tid":12,"name":"The Mixon Administration","abbrev":"JL","w":7,"l":7,"t":0,"pf":1493.8,"pa":1526,"finalRank":11,"seed":7,"owner":"James Laethem","madePlayoffs":false}],"leagueName":"MSU Fantasy Football League"},"2024":{"teams":[{"tid":1,"name":"Lets Cook","abbrev":"COOK","w":7,"l":7,"t":0,"pf":1546.5,"pa":1436.3,"finalRank":8,"seed":7,"owner":"Adam Banchiu","madePlayoffs":false},{"tid":2,"name":"Benches Don't Score Points I Do","abbrev":"13yr","w":8,"l":6,"t":0,"pf":1586.9,"pa":1471.0,"finalRank":6,"seed":5,"owner":"Jeff Butler","madePlayoffs":true},{"tid":3,"name":"Windy City Waterboys","abbrev":"WCW","w":7,"l":7,"t":0,"pf":1553.6,"pa":1475,"finalRank":5,"seed":6,"owner":"Campbell Gillespie","madePlayoffs":true},{"tid":4,"name":"The Benchwarmers","abbrev":"CPS","w":9,"l":5,"t":0,"pf":1476.4,"pa":1379.2,"finalRank":1,"seed":2,"owner":"Casey Smith","madePlayoffs":true},{"tid":5,"name":"Show Me Your TDs","abbrev":"TITS","w":7,"l":7,"t":0,"pf":1502.2,"pa":1405.5,"finalRank":7,"seed":8,"owner":"Braden Geraldo","madePlayoffs":false},{"tid":6,"name":"Cant REED Cant Write","abbrev":"BK","w":8,"l":6,"t":0,"pf":1533.7,"pa":1466.6,"finalRank":4,"seed":3,"owner":"Blake Keaton","madePlayoffs":true},{"tid":7,"name":"There's a YOU Sheriff in Town","abbrev":"YOU!","w":9,"l":5,"t":0,"pf":1551.0,"pa":1376.1,"finalRank":2,"seed":4,"owner":"Bob Willen","madePlayoffs":true},{"tid":8,"name":"Detroit Lions Defense","abbrev":"IR","w":10,"l":4,"t":0,"pf":1559.8,"pa":1388.6,"finalRank":3,"seed":1,"owner":"Brad White","madePlayoffs":true},{"tid":9,"name":"Half Chubb","abbrev":"COS","w":5,"l":9,"t":0,"pf":1272.9,"pa":1425.1,"finalRank":11,"seed":11,"owner":"Michael Costello","madePlayoffs":false},{"tid":10,"name":"The Nixon Administration","abbrev":"BJNM","w":7,"l":7,"t":0,"pf":1307.4,"pa":1467.1,"finalRank":9,"seed":9,"owner":"Collin Frink","madePlayoffs":false},{"tid":11,"name":"Drunkin' Polacks","abbrev":"POL","w":2,"l":12,"t":0,"pf":1045.2,"pa":1533.1,"finalRank":12,"seed":12,"owner":"Kyle Chorazyczewski","madePlayoffs":false},{"tid":12,"name":"The Mixon Administration","abbrev":"MIX","w":5,"l":9,"t":0,"pf":1397.7,"pa":1509.6,"finalRank":10,"seed":10,"owner":"James Laethem","madePlayoffs":false}],"leagueName":"MSU Fantasy Football League"},"2025":{"teams":[{"tid":1,"name":"Lets Cook","abbrev":"COOK","w":4,"l":10,"t":0,"pf":1289.4,"pa":1417.2,"finalRank":9,"seed":10,"owner":"Adam Banchiu","madePlayoffs":false},{"tid":2,"name":"Benches Don't Score Points I Do","abbrev":"13yr","w":8,"l":6,"t":0,"pf":1509.1,"pa":1398.1,"finalRank":5,"seed":5,"owner":"Jeff Butler","madePlayoffs":true},{"tid":3,"name":"Windy City Waterboys","abbrev":"WCW","w":11,"l":3,"t":0,"pf":1770.9,"pa":1497.1,"finalRank":3,"seed":1,"owner":"Campbell Gillespie","madePlayoffs":true},{"tid":4,"name":"The Benchwarmers","abbrev":"CPS","w":7,"l":7,"t":0,"pf":1327.8,"pa":1231.0,"finalRank":11,"seed":7,"owner":"Casey Smith","madePlayoffs":false},{"tid":5,"name":"Show Me Your TDs","abbrev":"TITS","w":11,"l":3,"t":0,"pf":1625.1,"pa":1427.8,"finalRank":2,"seed":2,"owner":"Braden Geraldo","madePlayoffs":true},{"tid":6,"name":"Quarter Chubb","abbrev":"BK","w":5,"l":9,"t":0,"pf":1252.6,"pa":1292.7,"finalRank":10,"seed":9,"owner":"Blake Keaton","madePlayoffs":false},{"tid":7,"name":"There's a YOU Sheriff in Town","abbrev":"YOU!","w":10,"l":4,"t":0,"pf":1616.9,"pa":1468.8,"finalRank":1,"seed":4,"owner":"Bob Willen","madePlayoffs":true},{"tid":8,"name":"I've Fallen and I Can't Get Up","abbrev":"OLD","w":7,"l":7,"t":0,"pf":1440.1,"pa":1484.2,"finalRank":6,"seed":6,"owner":"Brad White","madePlayoffs":true},{"tid":9,"name":"Half Chubb","abbrev":"COS","w":6,"l":8,"t":0,"pf":1276.1,"pa":1454.1,"finalRank":7,"seed":8,"owner":"Michael Costello","madePlayoffs":false},{"tid":10,"name":"The Nixon Administration","abbrev":"BJNM","w":3,"l":11,"t":0,"pf":1213.7,"pa":1585.2,"finalRank":8,"seed":11,"owner":"Collin Frink","madePlayoffs":false},{"tid":11,"name":"Drunkin' Polacks","abbrev":"POL","w":9,"l":5,"t":0,"pf":1508.1,"pa":1448.8,"finalRank":4,"seed":3,"owner":"Kyle Chorazyczewski","madePlayoffs":true},{"tid":12,"name":"The Mixon Administration","abbrev":"MIX","w":3,"l":11,"t":0,"pf":1134.3,"pa":1259.3,"finalRank":12,"seed":12,"owner":"James Laethem","madePlayoffs":false}],"leagueName":"MSU Fantasy Football League"}},"ownerStats":{"Adam Banchiu":{"titles":1,"playoffs":6,"w":102,"l":98,"t":0,"pf":19475.9,"pa":19584.5,"wpct":0.51,"seasons_played":15,"best_finish":1},"Jeff Butler":{"titles":0,"playoffs":2,"w":74,"l":126,"t":0,"pf":18187.1,"pa":19922.4,"wpct":0.37,"seasons_played":15,"best_finish":5},"Dan Miller":{"titles":0,"playoffs":1,"w":9,"l":4,"t":0,"pf":1286.0,"pa":1037.0,"wpct":0.692,"seasons_played":1,"best_finish":3},"Casey Smith":{"titles":3,"playoffs":8,"w":115,"l":85,"t":0,"pf":19955.6,"pa":19170.3,"wpct":0.575,"seasons_played":15,"best_finish":1},"Braden Geraldo":{"titles":3,"playoffs":12,"w":122,"l":78,"t":0,"pf":21773.7,"pa":19649.3,"wpct":0.61,"seasons_played":15,"best_finish":1},"Blake Keaton":{"titles":1,"playoffs":8,"w":99,"l":101,"t":0,"pf":19753.8,"pa":19414.5,"wpct":0.495,"seasons_played":15,"best_finish":1},"Kevin Wilberding":{"titles":0,"playoffs":0,"w":8,"l":18,"t":0,"pf":2105.0,"pa":2378.0,"wpct":0.308,"seasons_played":2,"best_finish":5},"Brad White":{"titles":4,"playoffs":12,"w":125,"l":75,"t":0,"pf":21245.3,"pa":19513.6,"wpct":0.625,"seasons_played":15,"best_finish":1},"Hank Carpenter":{"titles":0,"playoffs":1,"w":12,"l":14,"t":0,"pf":2038.0,"pa":2378.0,"wpct":0.462,"seasons_played":2,"best_finish":2},"Jay Gersonde":{"titles":0,"playoffs":1,"w":13,"l":13,"t":0,"pf":2211.0,"pa":2149.0,"wpct":0.5,"seasons_played":2,"best_finish":4},"Campbell Gillespie":{"titles":0,"playoffs":8,"w":96,"l":91,"t":0,"pf":18824.6,"pa":19221.1,"wpct":0.513,"seasons_played":14,"best_finish":2},"Matthew Currier":{"titles":0,"playoffs":0,"w":19,"l":33,"t":0,"pf":4749.5,"pa":5284.1,"wpct":0.365,"seasons_played":4,"best_finish":7},"Michael Costello":{"titles":0,"playoffs":5,"w":74,"l":100,"t":0,"pf":16461.8,"pa":17591.0,"wpct":0.425,"seasons_played":13,"best_finish":2},"Collin Frink":{"titles":0,"playoffs":2,"w":77,"l":97,"t":0,"pf":16341.8,"pa":17224.3,"wpct":0.443,"seasons_played":13,"best_finish":4},"Matt Steinmetz":{"titles":0,"playoffs":0,"w":5,"l":8,"t":0,"pf":1143.7,"pa":1171.4,"wpct":0.385,"seasons_played":1,"best_finish":9},"Kyle Chorazyczewski":{"titles":0,"playoffs":7,"w":74,"l":74,"t":0,"pf":15361.7,"pa":15240.1,"wpct":0.5,"seasons_played":11,"best_finish":3},"James Laethem":{"titles":2,"playoffs":5,"w":66,"l":69,"t":0,"pf":14211.9,"pa":13802.0,"wpct":0.489,"seasons_played":10,"best_finish":1},"Scott Simon":{"titles":0,"playoffs":1,"w":27,"l":39,"t":0,"pf":6298.6,"pa":6878.9,"wpct":0.409,"seasons_played":5,"best_finish":4},"Bob Willen":{"titles":1,"playoffs":3,"w":31,"l":25,"t":0,"pf":5820.9,"pa":5636.2,"wpct":0.554,"seasons_played":4,"best_finish":1}},"h2h":{"Blake Keaton":{"Adam Banchiu":{"w":4,"l":9,"t":0,"pf":1251.9,"pa":1315.4},"Brad White":{"w":11,"l":16,"t":0,"pf":2557.7,"pa":2699.0},"Jay Gersonde":{"w":2,"l":2,"t":0,"pf":339.0,"pa":308.0},"Kevin Wilberding":{"w":4,"l":0,"t":0,"pf":434.0,"pa":319.0},"Hank Carpenter":{"w":2,"l":2,"t":0,"pf":399.0,"pa":319.0},"Jeff Butler":{"w":13,"l":1,"t":0,"pf":1383.3,"pa":1139.7},"Dan Miller":{"w":0,"l":1,"t":0,"pf":36.0,"pa":57.0},"Casey Smith":{"w":5,"l":10,"t":0,"pf":1469.4,"pa":1535.6},"Braden Geraldo":{"w":6,"l":11,"t":0,"pf":1794.7,"pa":1954.1},"Campbell Gillespie":{"w":10,"l":9,"t":0,"pf":1874.2,"pa":1723.2},"Collin Frink":{"w":8,"l":11,"t":0,"pf":1789.1,"pa":1891.7},"Matthew Currier":{"w":5,"l":1,"t":0,"pf":696.3,"pa":604.3},"Michael Costello":{"w":10,"l":6,"t":0,"pf":1677.8,"pa":1550.0},"Kyle Chorazyczewski":{"w":6,"l":8,"t":0,"pf":1321.3,"pa":1301.8},"Matt Steinmetz":{"w":1,"l":0,"t":0,"pf":101.2,"pa":71.7},"James Laethem":{"w":5,"l":11,"t":0,"pf":1612.8,"pa":1701.0},"Scott Simon":{"w":4,"l":1,"t":0,"pf":540.0,"pa":451.3},"Bob Willen":{"w":3,"l":2,"t":0,"pf":476.0,"pa":472.8}},"Adam Banchiu":{"Blake Keaton":{"w":9,"l":4,"t":0,"pf":1315.4,"pa":1251.9},"Dan Miller":{"w":1,"l":1,"t":0,"pf":186.0,"pa":198.0},"Braden Geraldo":{"w":11,"l":14,"t":0,"pf":2435.6,"pa":2532.0},"Jeff Butler":{"w":11,"l":8,"t":0,"pf":1712.4,"pa":1678.9},"Casey Smith":{"w":13,"l":9,"t":0,"pf":2159.1,"pa":2070.0},"Jay Gersonde":{"w":1,"l":1,"t":0,"pf":178.0,"pa":194.0},"Hank Carpenter":{"w":1,"l":1,"t":0,"pf":175.0,"pa":166.0},"Brad White":{"w":3,"l":10,"t":0,"pf":1131.4,"pa":1381.3},"Kevin Wilberding":{"w":2,"l":0,"t":0,"pf":199.0,"pa":190.0},"Campbell Gillespie":{"w":10,"l":11,"t":0,"pf":2061.8,"pa":2117.2},"Collin Frink":{"w":7,"l":6,"t":0,"pf":1345.5,"pa":1269.5},"Michael Costello":{"w":9,"l":10,"t":0,"pf":1886.4,"pa":1773.8},"Matthew Currier":{"w":4,"l":3,"t":0,"pf":609.0,"pa":643.0},"Matt Steinmetz":{"w":1,"l":0,"t":0,"pf":137.1,"pa":84.4},"Kyle Chorazyczewski":{"w":6,"l":6,"t":0,"pf":1296.9,"pa":1284.6},"James Laethem":{"w":9,"l":3,"t":0,"pf":1346.1,"pa":1303.0},"Scott Simon":{"w":2,"l":7,"t":0,"pf":734.8,"pa":830.3},"Bob Willen":{"w":2,"l":4,"t":0,"pf":566.6,"pa":616.8}},"Braden Geraldo":{"Jeff Butler":{"w":16,"l":5,"t":0,"pf":2442.9,"pa":1938.7},"Casey Smith":{"w":8,"l":13,"t":0,"pf":2111.1,"pa":2146.9},"Adam Banchiu":{"w":14,"l":11,"t":0,"pf":2532.0,"pa":2435.6},"Dan Miller":{"w":0,"l":2,"t":0,"pf":154.0,"pa":211.0},"Jay Gersonde":{"w":2,"l":0,"t":0,"pf":189.0,"pa":163.0},"Hank Carpenter":{"w":1,"l":1,"t":0,"pf":143.0,"pa":102.0},"Brad White":{"w":5,"l":12,"t":0,"pf":1797.9,"pa":1975.5},"Kevin Wilberding":{"w":0,"l":2,"t":0,"pf":143.0,"pa":204.0},"Blake Keaton":{"w":11,"l":6,"t":0,"pf":1954.1,"pa":1794.7},"Campbell Gillespie":{"w":7,"l":9,"t":0,"pf":1892.3,"pa":1725.8},"Collin Frink":{"w":11,"l":4,"t":0,"pf":1620.0,"pa":1444.1},"Michael Costello":{"w":15,"l":3,"t":0,"pf":2097.3,"pa":1519.4},"Matthew Currier":{"w":5,"l":1,"t":0,"pf":724.7,"pa":511.0},"Matt Steinmetz":{"w":1,"l":0,"t":0,"pf":81.6,"pa":71.7},"James Laethem":{"w":7,"l":3,"t":0,"pf":1093.4,"pa":1043.5},"Kyle Chorazyczewski":{"w":8,"l":4,"t":0,"pf":1342.2,"pa":1160.9},"Scott Simon":{"w":9,"l":0,"t":0,"pf":1032.5,"pa":771.3},"Bob Willen":{"w":2,"l":2,"t":0,"pf":422.7,"pa":430.0}},"Jeff Butler":{"Braden Geraldo":{"w":5,"l":16,"t":0,"pf":1938.7,"pa":2442.9},"Kevin Wilberding":{"w":1,"l":1,"t":0,"pf":150.0,"pa":196.0},"Casey Smith":{"w":7,"l":17,"t":0,"pf":2020.6,"pa":2414.3},"Adam Banchiu":{"w":8,"l":11,"t":0,"pf":1678.9,"pa":1712.4},"Dan Miller":{"w":0,"l":2,"t":0,"pf":159.0,"pa":227.0},"Blake Keaton":{"w":1,"l":13,"t":0,"pf":1139.7,"pa":1383.3},"Jay Gersonde":{"w":0,"l":2,"t":0,"pf":127.0,"pa":178.0},"Hank Carpenter":{"w":1,"l":1,"t":0,"pf":156.0,"pa":167.0},"Brad White":{"w":7,"l":10,"t":0,"pf":1509.2,"pa":1626.2},"Campbell Gillespie":{"w":10,"l":7,"t":0,"pf":1681.1,"pa":1575.9},"Matthew Currier":{"w":3,"l":1,"t":0,"pf":388.8,"pa":331.5},"Collin Frink":{"w":10,"l":11,"t":0,"pf":1996.5,"pa":1901.2},"Michael Costello":{"w":4,"l":11,"t":0,"pf":1393.9,"pa":1474.9},"Matt Steinmetz":{"w":0,"l":1,"t":0,"pf":86.3,"pa":105.4},"Kyle Chorazyczewski":{"w":9,"l":7,"t":0,"pf":1589.7,"pa":1653.8},"James Laethem":{"w":4,"l":8,"t":0,"pf":1137.1,"pa":1315.1},"Scott Simon":{"w":2,"l":4,"t":0,"pf":574.8,"pa":685.3},"Bob Willen":{"w":2,"l":3,"t":0,"pf":459.7,"pa":532.4}},"Jay Gersonde":{"Kevin Wilberding":{"w":2,"l":2,"t":0,"pf":306.0,"pa":323.0},"Hank Carpenter":{"w":1,"l":3,"t":0,"pf":305.0,"pa":360.0},"Blake Keaton":{"w":2,"l":2,"t":0,"pf":308.0,"pa":339.0},"Brad White":{"w":3,"l":1,"t":0,"pf":418.0,"pa":323.0},"Braden Geraldo":{"w":0,"l":2,"t":0,"pf":163.0,"pa":189.0},"Adam Banchiu":{"w":1,"l":1,"t":0,"pf":194.0,"pa":178.0},"Jeff Butler":{"w":2,"l":0,"t":0,"pf":178.0,"pa":127.0},"Dan Miller":{"w":1,"l":0,"t":0,"pf":80.0,"pa":73.0},"Casey Smith":{"w":1,"l":1,"t":0,"pf":175.0,"pa":132.0},"Campbell Gillespie":{"w":0,"l":1,"t":0,"pf":84.0,"pa":105.0}},"Kevin Wilberding":{"Jay Gersonde":{"w":2,"l":2,"t":0,"pf":323.0,"pa":306.0},"Jeff Butler":{"w":1,"l":1,"t":0,"pf":196.0,"pa":150.0},"Hank Carpenter":{"w":1,"l":3,"t":0,"pf":284.0,"pa":344.0},"Blake Keaton":{"w":0,"l":4,"t":0,"pf":319.0,"pa":434.0},"Brad White":{"w":0,"l":4,"t":0,"pf":278.0,"pa":449.0},"Dan Miller":{"w":1,"l":0,"t":0,"pf":99.0,"pa":74.0},"Casey Smith":{"w":1,"l":1,"t":0,"pf":168.0,"pa":195.0},"Braden Geraldo":{"w":2,"l":0,"t":0,"pf":204.0,"pa":143.0},"Adam Banchiu":{"w":0,"l":2,"t":0,"pf":190.0,"pa":199.0},"Campbell Gillespie":{"w":0,"l":1,"t":0,"pf":44.0,"pa":84.0}},"Dan Miller":{"Casey Smith":{"w":2,"l":0,"t":0,"pf":221.0,"pa":133.0},"Adam Banchiu":{"w":1,"l":1,"t":0,"pf":198.0,"pa":186.0},"Brad White":{"w":0,"l":1,"t":0,"pf":111.0,"pa":152.0},"Braden Geraldo":{"w":2,"l":0,"t":0,"pf":211.0,"pa":154.0},"Jeff Butler":{"w":2,"l":0,"t":0,"pf":227.0,"pa":159.0},"Kevin Wilberding":{"w":0,"l":1,"t":0,"pf":74.0,"pa":99.0},"Blake Keaton":{"w":1,"l":0,"t":0,"pf":57.0,"pa":36.0},"Jay Gersonde":{"w":0,"l":1,"t":0,"pf":73.0,"pa":80.0},"Hank Carpenter":{"w":1,"l":0,"t":0,"pf":114.0,"pa":38.0}},"Casey Smith":{"Dan Miller":{"w":0,"l":2,"t":0,"pf":133.0,"pa":221.0},"Braden Geraldo":{"w":13,"l":8,"t":0,"pf":2146.9,"pa":2111.1},"Jeff Butler":{"w":17,"l":7,"t":0,"pf":2414.3,"pa":2020.6},"Hank Carpenter":{"w":2,"l":0,"t":0,"pf":253.0,"pa":159.0},"Adam Banchiu":{"w":9,"l":13,"t":0,"pf":2070.0,"pa":2159.1},"Brad White":{"w":7,"l":8,"t":0,"pf":1607.6,"pa":1627.0},"Kevin Wilberding":{"w":1,"l":1,"t":0,"pf":195.0,"pa":168.0},"Blake Keaton":{"w":10,"l":5,"t":0,"pf":1535.6,"pa":1469.4},"Jay Gersonde":{"w":1,"l":1,"t":0,"pf":132.0,"pa":175.0},"Campbell Gillespie":{"w":11,"l":11,"t":0,"pf":2247.3,"pa":2143.9},"Michael Costello":{"w":7,"l":7,"t":0,"pf":1338.1,"pa":1321.6},"Matthew Currier":{"w":2,"l":2,"t":0,"pf":341.6,"pa":372.8},"Collin Frink":{"w":15,"l":5,"t":0,"pf":2003.4,"pa":1621.4},"Matt Steinmetz":{"w":1,"l":0,"t":0,"pf":99.2,"pa":88.3},"Kyle Chorazyczewski":{"w":5,"l":7,"t":0,"pf":1212.0,"pa":1352.6},"Scott Simon":{"w":4,"l":3,"t":0,"pf":820.7,"pa":732.9},"James Laethem":{"w":8,"l":2,"t":0,"pf":906.5,"pa":893.1},"Bob Willen":{"w":2,"l":3,"t":0,"pf":499.6,"pa":533.4}},"Hank Carpenter":{"Brad White":{"w":1,"l":3,"t":0,"pf":333.0,"pa":440.0},"Jay Gersonde":{"w":3,"l":1,"t":0,"pf":360.0,"pa":305.0},"Kevin Wilberding":{"w":3,"l":1,"t":0,"pf":344.0,"pa":284.0},"Casey Smith":{"w":0,"l":2,"t":0,"pf":159.0,"pa":253.0},"Blake Keaton":{"w":2,"l":2,"t":0,"pf":319.0,"pa":399.0},"Braden Geraldo":{"w":1,"l":1,"t":0,"pf":102.0,"pa":143.0},"Adam Banchiu":{"w":1,"l":1,"t":0,"pf":166.0,"pa":175.0},"Jeff Butler":{"w":1,"l":1,"t":0,"pf":167.0,"pa":156.0},"Dan Miller":{"w":0,"l":1,"t":0,"pf":38.0,"pa":114.0},"Campbell Gillespie":{"w":0,"l":1,"t":0,"pf":50.0,"pa":109.0}},"Brad White":{"Hank Carpenter":{"w":3,"l":1,"t":0,"pf":440.0,"pa":333.0},"Blake Keaton":{"w":16,"l":11,"t":0,"pf":2699.0,"pa":2557.7},"Dan Miller":{"w":1,"l":0,"t":0,"pf":152.0,"pa":111.0},"Jay Gersonde":{"w":1,"l":3,"t":0,"pf":323.0,"pa":418.0},"Kevin Wilberding":{"w":4,"l":0,"t":0,"pf":449.0,"pa":278.0},"Casey Smith":{"w":8,"l":7,"t":0,"pf":1627.0,"pa":1607.6},"Braden Geraldo":{"w":12,"l":5,"t":0,"pf":1975.5,"pa":1797.9},"Adam Banchiu":{"w":10,"l":3,"t":0,"pf":1381.3,"pa":1131.4},"Jeff Butler":{"w":10,"l":7,"t":0,"pf":1626.2,"pa":1509.2},"Campbell Gillespie":{"w":11,"l":7,"t":0,"pf":1981.7,"pa":1842.5},"Michael Costello":{"w":12,"l":6,"t":0,"pf":1874.9,"pa":1660.6},"Collin Frink":{"w":9,"l":4,"t":0,"pf":1266.8,"pa":1192.9},"Matthew Currier":{"w":2,"l":3,"t":0,"pf":522.0,"pa":530.3},"Kyle Chorazyczewski":{"w":9,"l":7,"t":0,"pf":1835.5,"pa":1736.7},"Matt Steinmetz":{"w":1,"l":0,"t":0,"pf":91.6,"pa":64.2},"James Laethem":{"w":10,"l":5,"t":0,"pf":1650.2,"pa":1475.5},"Scott Simon":{"w":4,"l":2,"t":0,"pf":708.1,"pa":561.7},"Bob Willen":{"w":2,"l":4,"t":0,"pf":641.5,"pa":705.3}},"Campbell Gillespie":{"Casey Smith":{"w":11,"l":11,"t":0,"pf":2143.9,"pa":2247.3},"Adam Banchiu":{"w":11,"l":10,"t":0,"pf":2117.2,"pa":2061.8},"Brad White":{"w":7,"l":11,"t":0,"pf":1842.5,"pa":1981.7},"Braden Geraldo":{"w":9,"l":7,"t":0,"pf":1725.8,"pa":1892.3},"Jeff Butler":{"w":7,"l":10,"t":0,"pf":1575.9,"pa":1681.1},"Kevin Wilberding":{"w":1,"l":0,"t":0,"pf":84.0,"pa":44.0},"Blake Keaton":{"w":9,"l":10,"t":0,"pf":1723.2,"pa":1874.2},"Jay Gersonde":{"w":1,"l":0,"t":0,"pf":105.0,"pa":84.0},"Hank Carpenter":{"w":1,"l":0,"t":0,"pf":109.0,"pa":50.0},"Matthew Currier":{"w":2,"l":2,"t":0,"pf":436.0,"pa":394.3},"Collin Frink":{"w":9,"l":9,"t":0,"pf":1677.6,"pa":1722.3},"Michael Costello":{"w":10,"l":3,"t":0,"pf":1418.0,"pa":1273.0},"Kyle Chorazyczewski":{"w":5,"l":7,"t":0,"pf":1223.1,"pa":1301.5},"Matt Steinmetz":{"w":0,"l":1,"t":0,"pf":56.0,"pa":121.6},"James Laethem":{"w":5,"l":5,"t":0,"pf":1086.3,"pa":1146.8},"Scott Simon":{"w":5,"l":3,"t":0,"pf":882.6,"pa":811.7},"Bob Willen":{"w":3,"l":2,"t":0,"pf":618.5,"pa":533.6}},"Collin Frink":{"Matthew Currier":{"w":3,"l":2,"t":0,"pf":492.8,"pa":433.5},"Michael Costello":{"w":7,"l":6,"t":0,"pf":1282.5,"pa":1288.6},"Blake Keaton":{"w":11,"l":8,"t":0,"pf":1891.7,"pa":1789.1},"Brad White":{"w":4,"l":9,"t":0,"pf":1192.9,"pa":1266.8},"Braden Geraldo":{"w":4,"l":11,"t":0,"pf":1444.1,"pa":1620.0},"Adam Banchiu":{"w":6,"l":7,"t":0,"pf":1269.5,"pa":1345.5},"Jeff Butler":{"w":11,"l":10,"t":0,"pf":1901.2,"pa":1996.5},"Campbell Gillespie":{"w":9,"l":9,"t":0,"pf":1722.3,"pa":1677.6},"Casey Smith":{"w":5,"l":15,"t":0,"pf":1621.4,"pa":2003.4},"Matt Steinmetz":{"w":1,"l":2,"t":0,"pf":232.4,"pa":268.4},"Kyle Chorazyczewski":{"w":9,"l":5,"t":0,"pf":1381.6,"pa":1445.3},"James Laethem":{"w":4,"l":9,"t":0,"pf":1243.4,"pa":1413.5},"Scott Simon":{"w":2,"l":1,"t":0,"pf":330.9,"pa":272.2},"Bob Willen":{"w":1,"l":3,"t":0,"pf":335.1,"pa":404.0}},"Matthew Currier":{"Collin Frink":{"w":2,"l":3,"t":0,"pf":433.5,"pa":492.8},"Jeff Butler":{"w":1,"l":3,"t":0,"pf":331.5,"pa":388.8},"Michael Costello":{"w":3,"l":5,"t":0,"pf":705.4,"pa":791.0},"Blake Keaton":{"w":1,"l":5,"t":0,"pf":604.3,"pa":696.3},"Brad White":{"w":3,"l":2,"t":0,"pf":530.3,"pa":522.0},"Campbell Gillespie":{"w":2,"l":2,"t":0,"pf":394.3,"pa":436.0},"Casey Smith":{"w":2,"l":2,"t":0,"pf":372.8,"pa":341.6},"Braden Geraldo":{"w":1,"l":5,"t":0,"pf":511.0,"pa":724.7},"Adam Banchiu":{"w":3,"l":4,"t":0,"pf":643.0,"pa":609.0},"Matt Steinmetz":{"w":1,"l":0,"t":0,"pf":68.9,"pa":45.1},"James Laethem":{"w":0,"l":1,"t":0,"pf":79.7,"pa":124.9},"Kyle Chorazyczewski":{"w":0,"l":1,"t":0,"pf":74.9,"pa":112.0}},"Michael Costello":{"Brad White":{"w":6,"l":12,"t":0,"pf":1660.6,"pa":1874.9},"Collin Frink":{"w":6,"l":7,"t":0,"pf":1288.6,"pa":1282.5},"Matthew Currier":{"w":5,"l":3,"t":0,"pf":791.0,"pa":705.4},"Casey Smith":{"w":7,"l":7,"t":0,"pf":1321.6,"pa":1338.1},"Blake Keaton":{"w":6,"l":10,"t":0,"pf":1550.0,"pa":1677.8},"Braden Geraldo":{"w":3,"l":15,"t":0,"pf":1519.4,"pa":2097.3},"Adam Banchiu":{"w":10,"l":9,"t":0,"pf":1773.8,"pa":1886.4},"Jeff Butler":{"w":11,"l":4,"t":0,"pf":1474.9,"pa":1393.9},"Campbell Gillespie":{"w":3,"l":10,"t":0,"pf":1273.0,"pa":1418.0},"Matt Steinmetz":{"w":0,"l":1,"t":0,"pf":103.3,"pa":138.1},"Kyle Chorazyczewski":{"w":4,"l":10,"t":0,"pf":1278.5,"pa":1382.7},"James Laethem":{"w":7,"l":6,"t":0,"pf":1249.2,"pa":1289.2},"Scott Simon":{"w":3,"l":3,"t":0,"pf":522.6,"pa":519.0},"Bob Willen":{"w":3,"l":3,"t":0,"pf":655.4,"pa":587.9}},"Kyle Chorazyczewski":{"Campbell Gillespie":{"w":7,"l":5,"t":0,"pf":1301.5,"pa":1223.1},"Blake Keaton":{"w":8,"l":6,"t":0,"pf":1301.8,"pa":1321.3},"Brad White":{"w":7,"l":9,"t":0,"pf":1736.7,"pa":1835.5},"Matt Steinmetz":{"w":1,"l":0,"t":0,"pf":113.9,"pa":84.9},"Collin Frink":{"w":5,"l":9,"t":0,"pf":1445.3,"pa":1381.6},"Casey Smith":{"w":7,"l":5,"t":0,"pf":1352.6,"pa":1212.0},"Jeff Butler":{"w":7,"l":9,"t":0,"pf":1653.8,"pa":1589.7},"Adam Banchiu":{"w":6,"l":6,"t":0,"pf":1284.6,"pa":1296.9},"Michael Costello":{"w":10,"l":4,"t":0,"pf":1382.7,"pa":1278.5},"James Laethem":{"w":7,"l":8,"t":0,"pf":1651.1,"pa":1678.0},"Braden Geraldo":{"w":4,"l":8,"t":0,"pf":1160.9,"pa":1342.2},"Matthew Currier":{"w":1,"l":0,"t":0,"pf":112.0,"pa":74.9},"Scott Simon":{"w":3,"l":1,"t":0,"pf":434.8,"pa":358.9},"Bob Willen":{"w":1,"l":4,"t":0,"pf":430.1,"pa":562.6}},"Matt Steinmetz":{"Collin Frink":{"w":2,"l":1,"t":0,"pf":268.4,"pa":232.4},"Casey Smith":{"w":0,"l":1,"t":0,"pf":88.3,"pa":99.2},"Jeff Butler":{"w":1,"l":0,"t":0,"pf":105.4,"pa":86.3},"Kyle Chorazyczewski":{"w":0,"l":1,"t":0,"pf":84.9,"pa":113.9},"Brad White":{"w":0,"l":1,"t":0,"pf":64.2,"pa":91.6},"Blake Keaton":{"w":0,"l":1,"t":0,"pf":71.7,"pa":101.2},"Campbell Gillespie":{"w":1,"l":0,"t":0,"pf":121.6,"pa":56.0},"Adam Banchiu":{"w":0,"l":1,"t":0,"pf":84.4,"pa":137.1},"Michael Costello":{"w":1,"l":0,"t":0,"pf":138.1,"pa":103.3},"Braden Geraldo":{"w":0,"l":1,"t":0,"pf":71.7,"pa":81.6},"Matthew Currier":{"w":0,"l":1,"t":0,"pf":45.1,"pa":68.9}},"James Laethem":{"Kyle Chorazyczewski":{"w":8,"l":7,"t":0,"pf":1678.0,"pa":1651.1},"Blake Keaton":{"w":11,"l":5,"t":0,"pf":1701.0,"pa":1612.8},"Brad White":{"w":5,"l":10,"t":0,"pf":1475.5,"pa":1650.2},"Braden Geraldo":{"w":3,"l":7,"t":0,"pf":1043.5,"pa":1093.4},"Campbell Gillespie":{"w":5,"l":5,"t":0,"pf":1146.8,"pa":1086.3},"Collin Frink":{"w":9,"l":4,"t":0,"pf":1413.5,"pa":1243.4},"Matthew Currier":{"w":1,"l":0,"t":0,"pf":124.9,"pa":79.7},"Adam Banchiu":{"w":3,"l":9,"t":0,"pf":1303.0,"pa":1346.1},"Jeff Butler":{"w":8,"l":4,"t":0,"pf":1315.1,"pa":1137.1},"Michael Costello":{"w":6,"l":7,"t":0,"pf":1289.2,"pa":1249.2},"Scott Simon":{"w":1,"l":2,"t":0,"pf":297.1,"pa":304.1},"Casey Smith":{"w":2,"l":8,"t":0,"pf":893.1,"pa":906.5},"Bob Willen":{"w":4,"l":1,"t":0,"pf":531.0,"pa":442.1}},"Scott Simon":{"Adam Banchiu":{"w":7,"l":2,"t":0,"pf":830.3,"pa":734.8},"Michael Costello":{"w":3,"l":3,"t":0,"pf":519.0,"pa":522.6},"Braden Geraldo":{"w":0,"l":9,"t":0,"pf":771.3,"pa":1032.5},"Casey Smith":{"w":3,"l":4,"t":0,"pf":732.9,"pa":820.7},"Jeff Butler":{"w":4,"l":2,"t":0,"pf":685.3,"pa":574.8},"Campbell Gillespie":{"w":3,"l":5,"t":0,"pf":811.7,"pa":882.6},"James Laethem":{"w":2,"l":1,"t":0,"pf":304.1,"pa":297.1},"Kyle Chorazyczewski":{"w":1,"l":3,"t":0,"pf":358.9,"pa":434.8},"Blake Keaton":{"w":1,"l":4,"t":0,"pf":451.3,"pa":540.0},"Brad White":{"w":2,"l":4,"t":0,"pf":561.7,"pa":708.1},"Collin Frink":{"w":1,"l":2,"t":0,"pf":272.2,"pa":330.9}},"Bob Willen":{"James Laethem":{"w":1,"l":4,"t":0,"pf":442.1,"pa":531.0},"Blake Keaton":{"w":2,"l":3,"t":0,"pf":472.8,"pa":476.0},"Adam Banchiu":{"w":4,"l":2,"t":0,"pf":616.8,"pa":566.6},"Collin Frink":{"w":3,"l":1,"t":0,"pf":404.0,"pa":335.1},"Casey Smith":{"w":3,"l":2,"t":0,"pf":533.4,"pa":499.6},"Campbell Gillespie":{"w":2,"l":3,"t":0,"pf":533.6,"pa":618.5},"Michael Costello":{"w":3,"l":3,"t":0,"pf":587.9,"pa":655.4},"Braden Geraldo":{"w":2,"l":2,"t":0,"pf":430.0,"pa":422.7},"Brad White":{"w":4,"l":2,"t":0,"pf":705.3,"pa":641.5},"Jeff Butler":{"w":3,"l":2,"t":0,"pf":532.4,"pa":459.7},"Kyle Chorazyczewski":{"w":4,"l":1,"t":0,"pf":562.6,"pa":430.1}}}};

// Helpers
function _h2hAggregate(ownerStats, h2h, owner) {
  const opps = h2h[owner] || {};
  let totW = 0, totL = 0, totT = 0, pf = 0, pa = 0;
  Object.values(opps).forEach(r => {
    totW += r.w; totL += r.l; totT += r.t; pf += r.pf; pa += r.pa;
  });
  return {w: totW, l: totL, t: totT, pf: Math.round(pf*10)/10, pa: Math.round(pa*10)/10};
}

function buildHistory() {
  const yearsDesc = HISTORY_DATA.years.slice().sort((a,b) => b - a);

  // ===== Section tab switching =====
  const sectionTabs = document.querySelectorAll('#history-section-tabs .history-section-tab');
  sectionTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      sectionTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.section;
      document.querySelectorAll('#page-history .history-section').forEach(s => {
        s.classList.toggle('active', s.id === `history-section-${target}`);
      });
    });
  });

  // ===== Champions =====
  const champGrid = document.getElementById('champions-grid');
  champGrid.innerHTML = yearsDesc.map(yr => {
    const season = HISTORY_DATA.seasons[yr];
    const champ = season ? season.teams.find(t => t.finalRank === 1) : null;
    if (!champ) return '';
    const tieStr = champ.t ? `-${champ.t}` : '';
    return `
      <div class="champion-card">
        <span class="champion-trophy">🏆</span>
        <div class="champion-year">${yr}</div>
        <div class="champion-team">${escHtml(champ.name)}</div>
        <div class="champion-mgr">${escHtml(champ.owner)}</div>
        <div class="champion-record">Reg. season ${champ.w}-${champ.l}${tieStr} · ${champ.pf.toFixed(1)} PF</div>
      </div>
    `;
  }).join('');

  // ===== Title Leaderboard =====
  const board = document.getElementById('title-leaderboard');
  const titled = Object.entries(HISTORY_DATA.ownerStats)
    .filter(([_, s]) => s.titles > 0)
    .sort((a,b) => b[1].titles - a[1].titles || b[1].wpct - a[1].wpct);
  // Per-owner championship years
  const titleYears = {};
  const secondPlaceCount = {};
  const lastPlaceCount = {};
  const pfLeaderCount = {};
  yearsDesc.slice().sort((a,b)=>a-b).forEach(yr => {
    const season = HISTORY_DATA.seasons[yr];
    if (!season) return;
    const champ = season.teams.find(t => t.finalRank === 1);
    if (champ) {
      titleYears[champ.owner] = titleYears[champ.owner] || [];
      titleYears[champ.owner].push(yr);
    }
    const runnerUp = season.teams.find(t => t.finalRank === 2);
    if (runnerUp) {
      secondPlaceCount[runnerUp.owner] = (secondPlaceCount[runnerUp.owner] || 0) + 1;
    }
    const maxRank = Math.max(...season.teams.map(t => t.finalRank));
    const lastPlace = season.teams.find(t => t.finalRank === maxRank);
    if (lastPlace) {
      lastPlaceCount[lastPlace.owner] = (lastPlaceCount[lastPlace.owner] || 0) + 1;
    }
    const maxPF = Math.max(...season.teams.map(t => t.pf));
    const pfLeader = season.teams.find(t => t.pf === maxPF);
    if (pfLeader) {
      pfLeaderCount[pfLeader.owner] = (pfLeaderCount[pfLeader.owner] || 0) + 1;
    }
  });
  let lastCount = -1, displayRank = 0;
  board.innerHTML = titled.map(([owner, s], i) => {
    if (s.titles !== lastCount) { displayRank = i + 1; lastCount = s.titles; }
    const trophies = '🏆'.repeat(Math.min(s.titles, 5));
    const yrs = (titleYears[owner] || []).join(', ');
    return `
      <div class="title-row">
        <span class="rank">${displayRank}</span>
        <div style="flex:1; min-width:0;">
          <div class="team">${escHtml(owner)}</div>
          <div class="mgr">${yrs}</div>
        </div>
        <span class="count">${s.titles}</span>
        <span class="trophies">${trophies}</span>
      </div>
    `;
  }).join('');

  // ===== All-time table =====
  const tbody = document.getElementById('alltime-tbody');
  const headers = document.querySelectorAll('#alltime-table th');
  const currentSet = new Set(HISTORY_DATA.currentOwners);
  let rows = Object.entries(HISTORY_DATA.ownerStats).map(([owner, s]) => {
    const games = s.w + s.l + s.t;
    const pfPerGame = games ? s.pf / games : 0;
    return {
      owner,
      isCurrent: currentSet.has(owner),
      seasons: s.seasons_played,
      record: `${s.w}-${s.l}${s.t ? '-'+s.t : ''}`,
      games,
      wpct: s.wpct,
      pfPerGame,
      titles: s.titles,
      titleYears: (titleYears[owner] || []).join(', '),
      secondPlace: secondPlaceCount[owner] || 0,
      lastPlace: lastPlaceCount[owner] || 0,
      pfLeader: pfLeaderCount[owner] || 0,
      playoffs: s.playoffs,
      best: s.best_finish || 99,
    };
  });

  function renderAllTime(rows) {
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td class="owner-cell ${r.isCurrent ? '' : 'inactive'}" ${r.isCurrent ? '' : 'title="Inactive — not in 2025 league"'}>${escHtml(r.owner)}</td>
        <td class="num seasons-cell">${r.seasons}</td>
        <td class="num">${r.record}</td>
        <td class="num"><span class="wpct-bar">${r.wpct.toFixed(3)}</span></td>
        <td class="num">${r.pfPerGame.toFixed(1)}</td>
        <td class="num">${r.playoffs}</td>
        <td class="num titles-cell" title="${r.titleYears}">${r.titles ? r.titles + ' 🏆' : '—'}</td>
        <td class="num">${r.secondPlace ? r.secondPlace + ' 🥈' : '—'}</td>
        <td class="num">${r.lastPlace ? r.lastPlace + ' 🚽' : '—'}</td>
        <td class="num">${r.pfLeader ? r.pfLeader + ' 🔥' : '—'}</td>
        <td class="num">${r.best === 99 ? '—' : '#' + r.best}</td>
      </tr>
    `).join('');
  }

  const sortKeys = ['owner','seasons','games','wpct','pfPerGame','playoffs','titles','secondPlace','lastPlace','pfLeader','best'];
  let curKey = 'wpct', curDir = -1;
  function sortBy(key, dir) {
    const sorted = rows.slice().sort((a,b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      let av = a[key], bv = b[key];
      if (key === 'best') { av = av || 99; bv = bv || 99; }
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    renderAllTime(sorted);
    headers.forEach((h, i) => {
      h.classList.remove('sort-asc','sort-desc');
      if (sortKeys[i] === key) h.classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');
    });
  }
  headers.forEach((h, i) => {
    h.addEventListener('click', () => {
      const key = sortKeys[i];
      if (key === curKey) curDir = -curDir;
      else { curKey = key; curDir = (key === 'owner') ? 1 : (key === 'best') ? 1 : -1; }
      sortBy(curKey, curDir);
    });
  });
  sortBy('wpct', -1);

  // ===== By-year standings =====
  const yearTabsEl = document.getElementById('history-year-tabs');
  const yearContentEl = document.getElementById('history-year-content');
  yearTabsEl.innerHTML = yearsDesc.map((yr, i) =>
    `<button class="year-tab ${i===0?'active':''}" data-year="${yr}">${yr}</button>`
  ).join('');

  function renderStandings(year) {
    const season = HISTORY_DATA.seasons[year];
    if (!season) { yearContentEl.innerHTML = ''; return; }
    const rows = season.teams.slice().sort((a,b) => {
      const fa = a.finalRank || 99, fb = b.finalRank || 99;
      if (fa !== fb) return fa - fb;
      return b.pf - a.pf;
    });
    let html = `<table class="standings-table"><thead><tr>
      <th></th><th>Team</th><th>Owner</th><th class="num">W-L</th><th class="num">PF</th><th class="num">PA</th><th class="num">Final</th>
    </tr></thead><tbody>`;
    rows.forEach((r) => {
      const isChamp = r.finalRank === 1;
      const tieStr = r.t ? '-' + r.t : '';
      const finalDisplay = r.finalRank ? '#' + r.finalRank : '—';
      html += `<tr class="${isChamp ? 'is-champ' : ''}">
        <td class="seed">${r.finalRank || ''}</td>
        <td class="team-cell">${escHtml(r.name)}${isChamp ? '<span class="champ-mark">🏆</span>' : ''}</td>
        <td class="mgr-cell">${escHtml(r.owner)}</td>
        <td class="num">${r.w}-${r.l}${tieStr}</td>
        <td class="num">${r.pf.toFixed(1)}</td>
        <td class="num">${r.pa.toFixed(1)}</td>
        <td class="num">${finalDisplay}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    yearContentEl.innerHTML = html;
  }
  yearTabsEl.querySelectorAll('.year-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      yearTabsEl.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      renderStandings(this.dataset.year);
    });
  });
  if (yearsDesc.length) renderStandings(yearsDesc[0]);

  // ===== Head-to-Head =====
  const h2hSelect = document.getElementById('h2h-owner-select');
  const h2hSummary = document.getElementById('h2h-summary');
  const h2hGrid = document.getElementById('h2h-grid');

  // Populate select with owners (current first, then inactive). Default to first current owner alphabetically.
  const allOwners = Object.keys(HISTORY_DATA.h2h).sort();
  const current = HISTORY_DATA.currentOwners.slice().sort();
  const inactive = allOwners.filter(o => !currentSet.has(o));
  h2hSelect.innerHTML =
    '<optgroup label="Current Owners">' + current.map(o => `<option value="${escHtml(o)}">${escHtml(o)}</option>`).join('') + '</optgroup>' +
    (inactive.length ? '<optgroup label="Past Owners">' + inactive.map(o => `<option value="${escHtml(o)}">${escHtml(o)}</option>`).join('') + '</optgroup>' : '');

  function renderH2H(owner) {
    const opps = HISTORY_DATA.h2h[owner] || {};
    const total = _h2hAggregate(HISTORY_DATA.ownerStats, HISTORY_DATA.h2h, owner);
    const games = total.w + total.l + total.t;
    h2hSummary.innerHTML = `<strong>${escHtml(owner)}</strong> all-time vs the field: <strong>${total.w}-${total.l}${total.t ? '-'+total.t : ''}</strong> (${games ? ((total.w + 0.5*total.t)/games).toFixed(3) : '0.000'}) · <strong>${total.pf.toFixed(1)}</strong> PF · <strong>${total.pa.toFixed(1)}</strong> PA over ${games} regular-season games.`;

    // Sort opponents: current first sorted by W%, then inactive
    const sorted = Object.entries(opps).map(([opp, r]) => {
      const g = r.w + r.l + r.t;
      const wpct = g ? (r.w + 0.5*r.t)/g : 0;
      return { opp, ...r, wpct, isCurrent: currentSet.has(opp) };
    }).sort((a,b) => {
      if (a.isCurrent !== b.isCurrent) return b.isCurrent - a.isCurrent;
      return b.wpct - a.wpct;
    });

    h2hGrid.innerHTML = sorted.map(r => {
      const tieStr = r.t ? '-' + r.t : '';
      const cls = r.w > r.l ? 'winning' : r.w < r.l ? 'losing' : 'even';
      const ptsClass = r.pf > r.pa ? 'higher' : r.pf < r.pa ? 'lower' : '';
      return `
        <div class="h2h-card ${cls}">
          <div class="opp">${escHtml(r.opp)}${r.isCurrent ? '' : ' <span style="color:var(--muted);font-size:0.7rem;">◌</span>'}</div>
          <div class="record">
            <span class="wl">${r.w}-${r.l}${tieStr}</span>
            <span style="color:var(--muted); font-size:0.78rem;">(${r.wpct.toFixed(3)})</span>
          </div>
          <div class="pts"><span class="${ptsClass}">${r.pf.toFixed(0)}</span> PF · ${r.pa.toFixed(0)} PA</div>
        </div>
      `;
    }).join('');
  }

  h2hSelect.addEventListener('change', () => renderH2H(h2hSelect.value));
  // Default to first current owner
  const defaultOwner = current[0] || allOwners[0];
  h2hSelect.value = defaultOwner;
  renderH2H(defaultOwner);
}

buildHome();
buildRosters();
buildKeepers();
buildDraft();
buildTrades();
buildWriteUps();
buildHistory();

// Make showTeamDetail global
window.showTeamDetail = showTeamDetail;

// ===================== TRADE ANALYZER =====================
(function() {

// ---- Player & Valuation Database (from MSUFFL Available Players spreadsheet) ----
const SP_DATA={
  "Bijan Robinson":{f:79.3,kc:null,t:"Super Stud"},
  "Jahmyr Gibbs":{f:80.0,kc:null,t:"Super Stud"},
  "Ja'Marr Chase":{f:76.7,kc:82,t:"Super Stud"},
  "Puka Nacua":{f:80.7,kc:22,t:"Super Stud"},
  "Jaxon Smith-Njigba":{f:78.7,kc:null,t:"Super Stud"},
  "Christian McCaffrey":{f:72.5,kc:107,t:"Super Stud"},
  "CeeDee Lamb":{f:54.0,kc:80,t:"WR Stud"},
  "Amon-Ra St. Brown":{f:60.5,kc:20,t:"WR Stud"},
  "Jonathan Taylor":{f:64.0,kc:80,t:"Super Stud"},
  "Justin Jefferson":{f:65.7,kc:100,t:"Super Stud"},
  "James Cook III":{f:58.3,kc:70,t:"RB Stud"},
  "De'Von Achane":{f:59.5,kc:12,t:"RB Stud"},
  "Ashton Jeanty":{f:47.5,kc:5,t:"RB Stud"},
  "Drake London":{f:60.7,kc:78,t:"WR Stud"},
  "Malik Nabers":{f:57.0,kc:9,t:"WR Stud"},
  "Trey McBride":{f:30.0,kc:13,t:"TE Stud"},
  "Omarion Hampton":{f:34.0,kc:5,t:"RB Starter"},
  "Saquon Barkley":{f:51.0,kc:116,t:"RB Stud"},
  "Nico Collins":{f:48.5,kc:23,t:"WR Stud"},
  "Brock Bowers":{f:28.0,kc:9,t:"TE Stud"},
  "Rashee Rice":{f:50.0,kc:13,t:"WR Starter"},
  "Chase Brown":{f:45.0,kc:13,t:"RB Starter"},
  "George Pickens":{f:38.7,kc:41,t:"WR Starter"},
  "Chris Olave":{f:34.0,kc:25,t:"WR Starter"},
  "Kenneth Walker III":{f:46.0,kc:74,t:"RB Starter"},
  "Josh Allen":{f:25.0,kc:30,t:"QB Stud"},
  "Jeremiyah Love":{f:33.0,kc:1,t:"RB Starter"},
  "A.J. Brown":{f:52.0,kc:88,t:"WR Stud"},
  "Lamar Jackson":{f:17.0,kc:26,t:"QB Stud"},
  "Josh Jacobs":{f:47.5,kc:60,t:"RB Stud"},
  "Tetairoa McMillan":{f:23.5,kc:5,t:"WR Starter"},
  "Derrick Henry":{f:51.0,kc:41,t:"RB Stud"},
  "Tee Higgins":{f:24.5,kc:26,t:"WR Starter"},
  "Garrett Wilson":{f:34.0,kc:61,t:"WR Stud"},
  "Drake Maye":{f:12.7,kc:9,t:"QB Stud"},
  "Colston Loveland":{f:16.5,kc:5,t:"TE Starter"},
  "Breece Hall":{f:40.7,kc:48,t:"RB Starter"},
  "Davante Adams":{f:21.0,kc:25,t:"WR Starter"},
  "Kyren Williams":{f:34.5,kc:20,t:"RB Starter"},
  "Zay Flowers":{f:22.0,kc:null,t:"WR Starter"},
  "Ladd McConkey":{f:15.0,kc:9,t:"WR Starter"},
  "Bucky Irving":{f:35.0,kc:9,t:"RB Starter"},
  "Travis Etienne Jr.":{f:25.7,kc:25,t:"RB Starter"},
  "Javonte Williams":{f:22.7,kc:13,t:"RB Starter"},
  "Luther Burden III":{f:9.5,kc:5,t:"WR Starter"},
  "DeVonta Smith":{f:18.5,kc:36,t:"WR Starter"},
  "Terry McLaurin":{f:22.5,kc:30,t:"WR Starter"},
  "Joe Burrow":{f:12.5,kc:28,t:"QB Stud"},
  "Jameson Williams":{f:22.7,kc:30,t:"WR Starter"},
  "Jaylen Waddle":{f:27.7,kc:54,t:"WR Starter"},
  "Jayden Daniels":{f:16.5,kc:9,t:"QB Stud"},
  "TreVeyon Henderson":{f:23.0,kc:5,t:"RB Starter"},
  "Emeka Egbuka":{f:13.5,kc:5,t:"WR Starter"},
  "Cam Skattebo":{f:23.5,kc:5,t:"RB Starter"},
  "Mike Evans":{f:15.5,kc:1,t:"WR Starter"},
  "Christian Watson":{f:8.5,kc:4,t:"WR Starter"},
  "D'Andre Swift":{f:25.5,kc:36,t:"RB Starter"},
  "Jalen Hurts":{f:13.0,kc:24,t:"QB Stud"},
  "Quinshon Judkins":{f:24.5,kc:5,t:"RB Starter"},
  "RJ Harvey":{f:17.5,kc:5,t:"RB Starter"},
  "Tucker Kraft":{f:13.0,kc:12,t:"TE Starter"},
  "David Montgomery":{f:21.3,kc:47,t:"RB Starter"},
  "Rome Odunze":{f:11.5,kc:9,t:"WR Starter"},
  "Bhayshul Tuten":{f:12.5,kc:6,t:"RB Depth"},
  "Tyler Warren":{f:13.5,kc:5,t:"TE Starter"},
  "DJ Moore":{f:16.0,kc:29,t:"WR Starter"},
  "Harold Fannin Jr.":{f:12.0,kc:8,t:"TE Starter"},
  "Jaylen Warren":{f:15.0,kc:8,t:"RB Depth"},
  "Courtland Sutton":{f:13.0,kc:10,t:"WR Starter"},
  "Carnell Tate":{f:5.5,kc:1,t:"WR Depth"},
  "Jaxson Dart":{f:7.0,kc:5,t:"QB Starter"},
  "DK Metcalf":{f:14.7,kc:25,t:"WR Starter"},
  "Marvin Harrison Jr.":{f:10.5,kc:9,t:"WR Starter"},
  "Justin Herbert":{f:8.0,kc:6,t:"QB Starter"},
  "Caleb Williams":{f:6.0,kc:9,t:"QB Starter"},
  "Makai Lemon":{f:5.0,kc:1,t:"WR Depth"},
  "Alec Pierce":{f:14.5,kc:4,t:"WR Starter"},
  "Kyle Monangai":{f:9.0,kc:4,t:"RB Depth"},
  "Rico Dowdle":{f:16.0,kc:13,t:"RB Depth"},
  "Rhamondre Stevenson":{f:13.5,kc:20,t:"RB Depth"},
  "Trevor Lawrence":{f:7.5,kc:4,t:"QB Starter"},
  "Chris Godwin Jr.":{f:10.0,kc:26,t:"WR Starter"},
  "Brian Thomas Jr.":{f:8.5,kc:9,t:"WR Starter"},
  "Jordyn Tyson":{f:6.0,kc:1,t:"WR Depth"},
  "Sam LaPorta":{f:13.5,kc:null,t:"TE Starter"},
  "Dak Prescott":{f:8.3,kc:13,t:"QB Starter"},
  "Kyle Pitts Sr.":{f:9.7,kc:6,t:"TE Starter"},
  "Chuba Hubbard":{f:13.0,kc:12,t:"RB Depth"},
  "Blake Corum":{f:8.0,kc:5,t:"RB Depth"},
  "Michael Wilson":{f:12.5,kc:4,t:"WR Starter"},
  "Jakobi Meyers":{f:10.5,kc:9,t:"WR Starter"},
  "Ricky Pearsall":{f:8.5,kc:9,t:"WR Starter"},
  "Tony Pollard":{f:20.3,kc:42,t:"RB Depth"},
  "Patrick Mahomes II":{f:8.3,kc:null,t:"QB Starter"},
  "Brock Purdy":{f:9.5,kc:4,t:"QB Starter"},
  "Jordan Addison":{f:7.0,kc:null,t:"WR Starter"},
  "Tyler Allgeier":{f:2.3,kc:4,t:"RB Depth"},
  "Michael Pittman Jr.":{f:6.3,kc:10,t:"WR Starter"},
  "Bo Nix":{f:4.5,kc:8,t:"QB Starter"},
  "Wan'Dale Robinson":{f:4.0,kc:4,t:"WR Depth"},
  "Matthew Stafford":{f:5.0,kc:5,t:"QB Starter"},
  "Parker Washington":{f:8.0,kc:null,t:"WR Starter"},
  "Aaron Jones Sr.":{f:18.7,kc:38,t:"RB Depth"},
  "Dalton Kincaid":{f:5.7,kc:8,t:"TE Starter"},
  "J.K. Dobbins":{f:14.0,kc:17,t:"RB Starter"},
  "Oronde Gadsden II":{f:3.5,kc:12,t:"TE Starter"},
  "Quentin Johnston":{f:5.0,kc:15,t:"WR Depth"},
  "Zach Charbonnet":{f:11.5,kc:null,t:"RB Depth"},
  "Jacory Croskey-Merritt":{f:8.5,kc:4,t:"RB Depth"},
  "Jake Ferguson":{f:4.5,kc:4,t:"TE Starter"},
  "James Conner":{f:5.5,kc:5,t:"RB Depth"},
  "Woody Marks":{f:10.0,kc:4,t:"RB Depth"},
  "Jordan Love":{f:2.5,kc:12,t:"QB Starter"},
  "Jared Goff":{f:2.3,kc:1,t:"QB Starter"},
  "Dallas Goedert":{f:9.0,kc:8,t:"TE Starter"},
  "Kyler Murray":{f:3.3,kc:null,t:"QB Starter"},
  "Stefon Diggs":{f:7.5,kc:8,t:"WR Starter"},
  "Kenneth Gainwell":{f:9.5,kc:4,t:"RB Depth"},
  "Jayden Higgins":{f:2.5,kc:5,t:"WR Depth"},
  "Jayden Reed":{f:7.0,kc:14,t:"WR Depth"},
  "Jauan Jennings":{f:3.3,kc:9,t:"WR Starter"},
  "Malik Willis":{f:0.5,kc:null,t:"QB Starter"},
  "Baker Mayfield":{f:3.0,kc:10,t:"QB Starter"},
  "Josh Downs":{f:2.5,kc:14,t:"WR Depth"},
  "Khalil Shakir":{f:7.0,kc:10,t:"WR Starter"},
  "Jordan Mason":{f:7.0,kc:9,t:"RB Depth"},
  "Tyler Shough":{f:1.5,kc:4,t:"QB Starter"},
  "Travis Kelce":{f:7.3,kc:10,t:"TE Starter"},
  "Tyrone Tracy Jr.":{f:5.0,kc:8,t:"RB Depth"},
  "Rachaad White":{f:5.3,kc:4,t:"RB Depth"},
  "Alvin Kamara":{f:7.5,kc:37,t:"RB Starter"},
  "Xavier Worthy":{f:2.5,kc:9,t:"WR Depth"},
  "Braelon Allen":{f:4.3,kc:4,t:"RB Depth"},
  "Juwan Johnson":{f:4.5,kc:null,t:"TE Starter"},
  "Jadarian Price":{f:7.5,kc:null,t:"RB Depth"},
  "Isaiah Likely":{f:1.0,kc:null,t:"TE Starter"},
  "Romeo Doubs":{f:3.0,kc:4,t:"WR Depth"},
  "Hunter Henry":{f:4.0,kc:4,t:"TE Starter"},
  "Dylan Sampson":{f:4.0,kc:null,t:"RB Depth"},
  "C.J. Stroud":{f:0.5,kc:4,t:"QB Starter"},
  "Jalen Coker":{f:2.5,kc:null,t:"WR Depth"},
  "Travis Hunter":{f:5.0,kc:5,t:"WR Starter"},
  "Tyjae Spears":{f:4.7,kc:6,t:"RB Depth"},
  "Brenton Strange":{f:6.5,kc:4,t:"TE Starter"},
  "Deebo Samuel Sr.":{f:5.3,kc:null,t:"WR Depth"},
  "George Kittle":{f:15.5,kc:22,t:"TE Stud"},
  "Isiah Pacheco":{f:14.0,kc:38,t:"RB Depth"},
  "Brandon Aiyuk":{f:6.7,kc:9,t:"WR Starter"},
  "Trey Benson":{f:2.5,kc:9,t:"RB Depth"},
  "Keaton Mitchell":{f:2.5,kc:4,t:"RB Depth"},
  "Matthew Golden":{f:0.5,kc:5,t:"WR Depth"},
  "Chris Rodriguez Jr.":{f:1.5,kc:4,t:"RB Depth"},
  "Tyreek Hill":{f:2.5,kc:4,t:"WR Depth"},
  "Sam Darnold":{f:0.0,kc:null,t:"QB Starter"},
  "Jerry Jeudy":{f:0.0,kc:4,t:"WR Depth"},
  "Tank Bigsby":{f:0.5,kc:4,t:"RB Depth"},
  "Houston Texans":{f:2.5,kc:null,t:"Defense"},
  "Jonah Coleman":{f:1.0,kc:null,t:"RB Depth"},
  "Denzel Boston":{f:3.0,kc:null,t:"WR Depth"},
  "Brian Robinson Jr.":{f:3.5,kc:null,t:"RB Depth"},
  "Rashid Shaheed":{f:2.3,kc:null,t:"WR Depth"},
  "Mark Andrews":{f:5.0,kc:4,t:"TE Starter"},
  "Adonai Mitchell":{f:2.5,kc:null,t:"WR Depth"},
  "Emmett Johnson":{f:1.0,kc:null,t:"RB Depth"},
  "Jonathon Brooks":{f:4.5,kc:4,t:"RB Depth"},
  "Bryce Young":{f:0.5,kc:null,t:"QB Depth"},
  "Kayshon Boutte":{f:0.5,kc:13,t:"WR Depth"},
  "Emanuel Wilson":{f:0.0,kc:17,t:"RB Depth"},
  "Chimere Dike":{f:0.5,kc:null,t:"WR Depth"},
  "Denver Broncos":{f:2.0,kc:null,t:"Defense"},
  "Omar Cooper Jr.":{f:2.5,kc:null,t:"WR Depth"},
  "Kenyon Sadiq":{f:1.0,kc:null,t:"TE Depth"},
  "Seattle Seahawks":{f:1.5,kc:null,t:"Defense"},
  "Mike Washington Jr.":{f:0.0,kc:null,t:"RB Depth"},
  "Cam Ward":{f:0.5,kc:null,t:"QB Starter"},
  "Los Angeles Rams":{f:1.0,kc:null,t:"Defense"},
  "Dalton Schultz":{f:0.0,kc:4,t:"TE Depth"},
  "Philadelphia Eagles":{f:0.5,kc:null,t:"Defense"},
  "Troy Franklin":{f:0.5,kc:null,t:"WR Depth"},
  "Jalen McMillan":{f:0.3,kc:null,t:"WR Depth"},
  "Minnesota Vikings":{f:1.0,kc:null,t:"Defense"},
  "New England Patriots":{f:0.5,kc:null,t:"Defense"},
  "Jacksonville Jaguars":{f:0.5,kc:null,t:"Defense"},
  "Brandon Aubrey":{f:2.0,kc:7,t:"Kicker"},
  "Kimani Vidal":{f:1.0,kc:null,t:"RB Depth"},
  "Los Angeles Chargers":{f:1.0,kc:null,t:"Defense"},
  "Pittsburgh Steelers":{f:1.0,kc:null,t:"Defense"},
  "Green Bay Packers":{f:0.5,kc:null,t:"Defense"},
  "Jaylin Noel":{f:0.5,kc:null,t:"WR Depth"},
  "Tre Harris":{f:0.5,kc:null,t:"WR Depth"},
  "Ka'imi Fairbairn":{f:1.3,kc:4,t:"Kicker"},
  "Elic Ayomanor":{f:0.5,kc:4,t:"WR Depth"},
  "Cam Little":{f:0.5,kc:null,t:"Kicker"},
  "Cameron Dicker":{f:1.5,kc:8,t:"Kicker"},
  "Cleveland Browns":{f:1.0,kc:null,t:"Defense"},
  "Pat Bryant":{f:0.5,kc:null,t:"WR Depth"},
  "Isaac TeSlaa":{f:0.5,kc:null,t:"WR Depth"},
  "Kaleb Johnson":{f:0.5,kc:4,t:"RB Depth"},
  "Sean Tucker":{f:0.5,kc:null,t:"RB Depth"},
  "AJ Barner":{f:0.5,kc:null,t:"TE Depth"},
  "Jason Myers":{f:1.0,kc:4,t:"Kicker"},
  "Jaylen Wright":{f:0.7,kc:null,t:"RB Depth"},
  "Tre Tucker":{f:0.0,kc:13,t:"WR Depth"},
  "Ryan Flournoy":{f:0.5,kc:null,t:"WR Depth"},
  "T.J. Hockenson":{f:0.5,kc:null,t:"TE Depth"},
  "K.C. Concepcion":{f:2.5,kc:null,t:"WR Depth"},
  "Tyler Loop":{f:1.0,kc:null,t:"Kicker"},
  "Terrance Ferguson":{f:0.5,kc:null,t:"TE Depth"},
  "Evan McPherson":{f:0.5,kc:null,t:"Kicker"},
  "Darnell Mooney":{f:2.3,kc:4,t:"WR Depth"},
  "Kansas City Chiefs":{f:0.0,kc:null,t:"Defense"},
  "Nicholas Singleton":{f:0.5,kc:null,t:"RB Depth"},
  "Eddy Pineiro":{f:1.5,kc:null,t:"Kicker"},
  "Chig Okonkwo":{f:0.5,kc:null,t:"TE Depth"},
  "Andy Borregales":{f:0.5,kc:null,t:"Kicker"},
  "Calvin Ridley":{f:0.5,kc:4,t:"WR Depth"},
  "Kyle Williams":{f:0.5,kc:null,t:"WR Depth"},
  "Jacoby Brissett":{f:0.0,kc:4,t:"QB Depth"},
  "Detroit Lions":{f:0.5,kc:null,t:"Defense"},
  "Ray Davis":{f:0.0,kc:null,t:"RB Depth"},
  "Chase McLaughlin":{f:1.0,kc:7,t:"Kicker"},
  "Daniel Jones":{f:0.5,kc:null,t:"QB Depth"},
  "Baltimore Ravens":{f:0.5,kc:null,t:"Defense"},
  "Cairo Santos":{f:1.0,kc:null,t:"Kicker"},
  "Devin Neal":{f:0.5,kc:null,t:"RB Depth"},
  "Mason Taylor":{f:0.5,kc:null,t:"TE Depth"},
  "Dontayvion Wicks":{f:0.0,kc:null,t:"WR Depth"},
  "Tank Dell":{f:2.5,kc:null,t:"WR Depth"},
  "Eli Stowers":{f:1.0,kc:null,t:"TE Depth"},
  "Joe Mixon":{f:11.0,kc:34,t:"RB Depth"},
  "Buffalo Bills":{f:0.5,kc:null,t:"Defense"},
  "Kendre Miller":{f:0.5,kc:null,t:"RB Depth"},
  "Keon Coleman":{f:0.0,kc:9,t:"WR Depth"},
  "Kaytron Allen":{f:1.0,kc:null,t:"RB Depth"},
  "Jake Bates":{f:1.0,kc:5,t:"Kicker"},
  "Rashod Bateman":{f:0.0,kc:8,t:"WR Depth"},
  "David Njoku":{f:0.5,kc:12,t:"TE Depth"},
  "Mack Hollins":{f:0.0,kc:null,t:"WR Depth"},
  "Marvin Mims Jr.":{f:0.3,kc:null,t:"WR Depth"},
  "Fernando Mendoza":{f:0.5,kc:null,t:"QB Depth"},
  "Tory Horton":{f:2.5,kc:null,t:"WR Depth"},
  "Harrison Mevis":{f:0.5,kc:null,t:"Kicker"},
  "Ollie Gordon II":{f:0.0,kc:4,t:"RB Depth"},
  "Najee Harris":{f:0.7,kc:null,t:"RB Depth"},
  "Gunnar Helm":{f:0.0,kc:null,t:"TE Depth"},
  "Isaiah Davis":{f:0.0,kc:null,t:"RB Depth"},
  "Xavier Legette":{f:0.0,kc:9,t:"WR Depth"},
  "Chris Bell":{f:1.0,kc:null,t:"WR Depth"},
  "Chris Boswell":{f:1.0,kc:null,t:"Kicker"},
  "Harrison Butker":{f:1.0,kc:5,t:"Kicker"},
  "Chris Brazzell II":{f:0.5,kc:null,t:"WR Depth"},
  "Elijah Sarratt":{f:0.5,kc:null,t:"WR Depth"},
  "Cooper Kupp":{f:1.7,kc:null,t:"WR Depth"},
  "Theo Johnson":{f:2.5,kc:7,t:"TE Depth"},
  "Brashard Smith":{f:0.0,kc:4,t:"RB Depth"},
  "Pat Freiermuth":{f:0.0,kc:null,t:"TE Depth"},
  "Colby Parkinson":{f:0.0,kc:null,t:"TE Depth"},
  "Ty Johnson":{f:1.0,kc:null,t:"RB Depth"},
  "Cade Otton":{f:0.0,kc:4,t:"TE Depth"},
  "Michael Penix Jr.":{f:0.7,kc:null,t:"QB Depth"},
  "Keenan Allen":{f:0.5,kc:7,t:"WR Depth"},
  "Isaac Guerendo":{f:0.3,kc:null,t:"RB Depth"},
  "Charlie Smyth":{f:0.0,kc:null,t:"Kicker"},
  "Zachariah Branch":{f:0.5,kc:null,t:"WR Depth"},
  "Jaleel McLaughlin":{f:0.0,kc:null,t:"RB Depth"},
  "J.J. McCarthy":{f:0.5,kc:null,t:"QB Depth"},
  "Darius Slayton":{f:0.0,kc:null,t:"WR Depth"},
  "Malachi Fields":{f:2.0,kc:null,t:"WR Depth"},
  "Isaiah Bond":{f:0.5,kc:null,t:"WR Depth"},
  "Devaughn Vele":{f:0.0,kc:null,t:"WR Depth"},
  "Atlanta Falcons":{f:0.5,kc:null,t:"Defense"},
  "Germie Bernard":{f:0.5,kc:null,t:"WR Depth"},
  "Jerome Ford":{f:0.0,kc:null,t:"RB Depth"},
  "Christian Kirk":{f:0.7,kc:null,t:"WR Depth"},
  "Wil Lutz":{f:0.3,kc:null,t:"Kicker"},
  "Malik Washington":{f:0.0,kc:4,t:"WR Depth"},
  "Malik Davis":{f:0.0,kc:null,t:"RB Depth"},
  "DJ Giddens":{f:0.0,kc:null,t:"RB Depth"},
  "Demond Claiborne":{f:0.0,kc:null,t:"RB Depth"},
  "Andrei Iosivas":{f:0.0,kc:null,t:"WR Depth"},
  "Shedeur Sanders":{f:0.5,kc:4,t:"QB Depth"},
  "Evan Engram":{f:1.7,kc:null,t:"TE Depth"},
  "Jack Bech":{f:0.0,kc:null,t:"WR Depth"},
  "Tyquan Thornton":{f:0.0,kc:null,t:"WR Depth"},
  "San Francisco 49ers":{f:0.0,kc:null,t:"Defense"},
  "Konata Mumpfield":{f:0.0,kc:null,t:"WR Depth"},
  "George Holani":{f:0.0,kc:null,t:"RB Depth"},
  "Jaydon Blue":{f:0.0,kc:null,t:"RB Depth"},
  "Bam Knight":{f:0.0,kc:4,t:"RB Depth"},
  "Jalen Nailor":{f:0.0,kc:null,t:"WR Depth"},
  "Hollywood Brown":{f:0.0,kc:null,t:"WR Depth"},
  "Audric Estime":{f:0.0,kc:null,t:"RB Depth"},
  "Calvin Austin III":{f:0.0,kc:4,t:"WR Depth"},
  "Jordan James":{f:0.0,kc:null,t:"RB Depth"},
  "LeQuint Allen Jr.":{f:0.0,kc:null,t:"RB Depth"},
  "Jake Tonges":{f:0.0,kc:null,t:"TE Depth"},
  "Indianapolis Colts":{f:0.0,kc:null,t:"Defense"},
  "Justice Hill":{f:3.0,kc:null,t:"RB Depth"},
  "Devin Singletary":{f:0.0,kc:5,t:"RB Depth"},
  "Jarquez Hunter":{f:0.0,kc:null,t:"RB Depth"},
  "Luke McCaffrey":{f:0.0,kc:null,t:"WR Depth"},
  "MarShawn Lloyd":{f:0.0,kc:null,t:"RB Depth"},
  "Chris Brooks":{f:0.0,kc:null,t:"RB Depth"},
  "Emari Demercado":{f:0.0,kc:null,t:"RB Depth"},
  "New Orleans Saints":{f:0.0,kc:null,t:"Defense"},
  "Geno Smith":{f:0.0,kc:null,t:"QB Depth"},
  "Greg Dulcich":{f:0.0,kc:null,t:"TE Depth"},
  "Mike Gesicki":{f:0.0,kc:null,t:"TE Depth"},
  "Cedric Tillman":{f:0.5,kc:null,t:"WR Depth"},
  "Aaron Rodgers":{f:0.0,kc:null,t:"QB Depth"},
  "Trevor Etienne":{f:0.0,kc:null,t:"RB Depth"},
  "Tua Tagovailoa":{f:0.0,kc:null,t:"QB Depth"},
  "Tommy Myers":{f:0.0,kc:1,t:"TE Depth"},
  "Samaje Perine":{f:1.5,kc:null,t:"RB Depth"},
  "Kareem Hunt":{f:0.0,kc:4,t:"RB Depth"},
  "Will Reichard":{f:0.5,kc:null,t:"Kicker"},
  "Mac Jones":{f:0.0,kc:null,t:"QB Depth"},
  "Dont'e Thornton Jr.":{f:0.0,kc:null,t:"WR Depth"},
  "Jalen Royals":{f:0.0,kc:null,t:"WR Depth"},
  "John Bates":{f:0.0,kc:null,t:"TE Depth"},
  "Ted Hurst":{f:0.5,kc:null,t:"WR Depth"},
  "Ty Simpson":{f:0.0,kc:null,t:"QB Depth"},
  "Tahj Brooks":{f:0.0,kc:null,t:"RB Depth"},
  "Tez Johnson":{f:0.0,kc:null,t:"WR Depth"},
  "Nick Chubb":{f:0.3,kc:5,t:"RB Depth"},
  "Michael Carter":{f:0.0,kc:null,t:"RB Depth"},
  "Deshaun Watson":{f:0.0,kc:null,t:"QB Depth"},
  "Will Shipley":{f:0.0,kc:null,t:"RB Depth"},
  "Tyler Higbee":{f:0.0,kc:null,t:"TE Depth"},
  "Olamide Zaccheaus":{f:0.0,kc:null,t:"WR Depth"},
  "Dallas Cowboys":{f:0.0,kc:null,t:"Defense"},
  "John Metchie III":{f:0.0,kc:4,t:"WR Depth"},
  "Zane Gonzalez":{f:0.0,kc:null,t:"Kicker"},
  "Joshua Palmer":{f:0.0,kc:null,t:"WR Depth"},
  "Jaylin Lane":{f:0.0,kc:null,t:"WR Depth"},
  "DeMario Douglas":{f:0.0,kc:null,t:"WR Depth"},
  "Carolina Panthers":{f:0.0,kc:null,t:"Defense"},
  "Antonio Williams":{f:0.5,kc:null,t:"WR Depth"},
  "Chicago Bears":{f:0.5,kc:null,t:"Defense"},
  "Kirk Cousins":{f:0.0,kc:null,t:"QB Depth"},
  "Xavier Hutchinson":{f:0.0,kc:null,t:"WR Depth"},
  "Skyler Bell":{f:0.5,kc:null,t:"WR Depth"},
  "Miami Dolphins":{f:0.0,kc:null,t:"Defense"},
  "Adam Randall":{f:0.0,kc:null,t:"RB Depth"},
  "Noah Gray":{f:0.0,kc:null,t:"TE Depth"},
  "Austin Ekeler":{f:0.7,kc:null,t:"RB Depth"},
  "Justin Fields":{f:0.0,kc:null,t:"QB Depth"},
  "Anthony Richardson Sr.":{f:0.0,kc:null,t:"QB Depth"},
  "Seth McGowan":{f:0.0,kc:null,t:"RB Depth"},
  "Joe Milton III":{f:0.0,kc:null,t:"QB Depth"},
  "Terrell Jennings":{f:0.0,kc:null,t:"RB Depth"},
  "Dameon Pierce":{f:0.0,kc:null,t:"RB Depth"},
  "Antonio Gibson":{f:0.0,kc:null,t:"RB Depth"},
  "Raheim Sanders":{f:0.0,kc:null,t:"RB Depth"},
  "Savion Williams":{f:0.0,kc:null,t:"WR Depth"},
  "Jawhar Jordan":{f:0.0,kc:null,t:"RB Depth"},
  "Treylon Burks":{f:0.0,kc:null,t:"WR Depth"}
};
const TP=[
  {name:"Bijan Robinson",pos:'RB',team:'ATL',age:23,val:95,adp:1},
  {name:"Jahmyr Gibbs",pos:'RB',team:'DET',age:23,val:95,adp:2},
  {name:"Ja'Marr Chase",pos:'WR',team:'CIN',age:25,val:90,adp:3},
  {name:"Puka Nacua",pos:'WR',team:'LAR',age:24,val:90,adp:4},
  {name:"Jaxon Smith-Njigba",pos:'WR',team:'SEA',age:22,val:95,adp:5},
  {name:"Christian McCaffrey",pos:'RB',team:'SF',age:28,val:84,adp:6},
  {name:"CeeDee Lamb",pos:'WR',team:'DAL',age:26,val:73,adp:7},
  {name:"Amon-Ra St. Brown",pos:'WR',team:'DET',age:25,val:73,adp:8},
  {name:"Jonathan Taylor",pos:'RB',team:'IND',age:26,val:90,adp:9},
  {name:"Justin Jefferson",pos:'WR',team:'MIN',age:26,val:90,adp:10},
  {name:"James Cook III",pos:'RB',team:'BUF',age:25,val:76,adp:11},
  {name:"De'Von Achane",pos:'RB',team:'MIA',age:24,val:76,adp:12},
  {name:"Ashton Jeanty",pos:'RB',team:'LV',age:22,val:84,adp:13},
  {name:"Drake London",pos:'WR',team:'ATL',age:24,val:73,adp:14},
  {name:"Malik Nabers",pos:'WR',team:'NYG',age:22,val:81,adp:15},
  {name:"Trey McBride",pos:'TE',team:'ARI',age:25,val:78,adp:16},
  {name:"Omarion Hampton",pos:'RB',team:'LAC',age:22,val:64,adp:17},
  {name:"Saquon Barkley",pos:'RB',team:'PHI',age:28,val:70,adp:18},
  {name:"Nico Collins",pos:'WR',team:'HOU',age:26,val:73,adp:19},
  {name:"Brock Bowers",pos:'TE',team:'LV',age:22,val:86,adp:20},
  {name:"Rashee Rice",pos:'WR',team:'KC',age:24,val:53,adp:21},
  {name:"Chase Brown",pos:'RB',team:'CIN',age:23,val:64,adp:22},
  {name:"George Pickens",pos:'WR',team:'DAL',age:23,val:61,adp:23},
  {name:"Chris Olave",pos:'WR',team:'NO',age:25,val:53,adp:24},
  {name:"Kenneth Walker III",pos:'RB',team:'KC',age:25,val:56,adp:25},
  {name:"Josh Allen",pos:'QB',team:'BUF',age:29,val:62,adp:26},
  {name:"Jeremiyah Love",pos:'RB',team:'FA',age:21,val:64,adp:27},
  {name:"A.J. Brown",pos:'WR',team:'PHI',age:27,val:73,adp:28},
  {name:"Lamar Jackson",pos:'QB',team:'BAL',age:28,val:62,adp:29},
  {name:"Josh Jacobs",pos:'RB',team:'GB',age:27,val:76,adp:30},
  {name:"Tetairoa McMillan",pos:'WR',team:'CAR',age:21,val:61,adp:31},
  {name:"Derrick Henry",pos:'RB',team:'BAL',age:31,val:64,adp:32},
  {name:"Tee Higgins",pos:'WR',team:'CIN',age:26,val:53,adp:33},
  {name:"Garrett Wilson",pos:'WR',team:'NYJ',age:25,val:73,adp:34},
  {name:"Drake Maye",pos:'QB',team:'NE',age:23,val:76,adp:35},
  {name:"Colston Loveland",pos:'TE',team:'CHI',age:22,val:60,adp:36},
  {name:"Breece Hall",pos:'RB',team:'NYJ',age:24,val:56,adp:37},
  {name:"Davante Adams",pos:'WR',team:'LAR',age:32,val:41,adp:38},
  {name:"Kyren Williams",pos:'RB',team:'LAR',age:25,val:56,adp:39},
  {name:"Zay Flowers",pos:'WR',team:'BAL',age:24,val:53,adp:40},
  {name:"Ladd McConkey",pos:'WR',team:'LAC',age:23,val:61,adp:41},
  {name:"Bucky Irving",pos:'RB',team:'TB',age:23,val:64,adp:42},
  {name:"Travis Etienne Jr.",pos:'RB',team:'NO',age:26,val:56,adp:43},
  {name:"Javonte Williams",pos:'RB',team:'DAL',age:25,val:56,adp:44},
  {name:"Luther Burden III",pos:'WR',team:'CHI',age:21,val:61,adp:45},
  {name:"DeVonta Smith",pos:'WR',team:'PHI',age:27,val:53,adp:46},
  {name:"Terry McLaurin",pos:'WR',team:'WAS',age:29,val:47,adp:47},
  {name:"Joe Burrow",pos:'QB',team:'CIN',age:28,val:62,adp:48},
  {name:"Jameson Williams",pos:'WR',team:'DET',age:23,val:61,adp:49},
  {name:"Jaylen Waddle",pos:'WR',team:'DEN',age:26,val:53,adp:50},
  {name:"Jayden Daniels",pos:'QB',team:'WAS',age:24,val:68,adp:51},
  {name:"TreVeyon Henderson",pos:'RB',team:'NE',age:23,val:64,adp:52},
  {name:"Emeka Egbuka",pos:'WR',team:'TB',age:22,val:61,adp:53},
  {name:"Cam Skattebo",pos:'RB',team:'NYG',age:22,val:64,adp:54},
  {name:"Mike Evans",pos:'WR',team:'SF',age:31,val:41,adp:55},
  {name:"Christian Watson",pos:'WR',team:'GB',age:24,val:53,adp:56},
  {name:"D'Andre Swift",pos:'RB',team:'CHI',age:26,val:56,adp:57},
  {name:"Jalen Hurts",pos:'QB',team:'PHI',age:27,val:68,adp:58},
  {name:"Quinshon Judkins",pos:'RB',team:'CLE',age:21,val:64,adp:59},
  {name:"RJ Harvey",pos:'RB',team:'DEN',age:22,val:64,adp:60},
  {name:"Tucker Kraft",pos:'TE',team:'GB',age:24,val:52,adp:61},
  {name:"David Montgomery",pos:'RB',team:'HOU',age:27,val:56,adp:62},
  {name:"Rome Odunze",pos:'WR',team:'CHI',age:23,val:61,adp:63},
  {name:"Bhayshul Tuten",pos:'RB',team:'JAC',age:22,val:38,adp:64},
  {name:"Tyler Warren",pos:'TE',team:'IND',age:22,val:60,adp:65},
  {name:"DJ Moore",pos:'WR',team:'BUF',age:27,val:53,adp:66},
  {name:"Harold Fannin Jr.",pos:'TE',team:'CLE',age:22,val:60,adp:67},
  {name:"Jaylen Warren",pos:'RB',team:'PIT',age:25,val:30,adp:68},
  {name:"Courtland Sutton",pos:'WR',team:'DEN',age:29,val:47,adp:69},
  {name:"Carnell Tate",pos:'WR',team:'FA',age:21,val:36,adp:70},
  {name:"Jaxson Dart",pos:'QB',team:'NYG',age:22,val:58,adp:71},
  {name:"DK Metcalf",pos:'WR',team:'PIT',age:27,val:53,adp:72},
  {name:"Marvin Harrison Jr.",pos:'WR',team:'ARI',age:22,val:61,adp:73},
  {name:"Justin Herbert",pos:'QB',team:'LAC',age:27,val:50,adp:74},
  {name:"Caleb Williams",pos:'QB',team:'CHI',age:23,val:58,adp:75},
  {name:"Makai Lemon",pos:'WR',team:'FA',age:25,val:28,adp:76},
  {name:"Alec Pierce",pos:'WR',team:'IND',age:25,val:53,adp:77},
  {name:"Kyle Monangai",pos:'RB',team:'CHI',age:22,val:38,adp:78},
  {name:"Rico Dowdle",pos:'RB',team:'PIT',age:27,val:30,adp:79},
  {name:"Rhamondre Stevenson",pos:'RB',team:'NE',age:27,val:30,adp:80},
  {name:"Trevor Lawrence",pos:'QB',team:'JAC',age:25,val:50,adp:81},
  {name:"Chris Godwin Jr.",pos:'WR',team:'TB',age:29,val:47,adp:82},
  {name:"Brian Thomas Jr.",pos:'WR',team:'JAC',age:22,val:61,adp:83},
  {name:"Jordyn Tyson",pos:'WR',team:'FA',age:21,val:36,adp:84},
  {name:"Sam LaPorta",pos:'TE',team:'DET',age:24,val:52,adp:85},
  {name:"Dak Prescott",pos:'QB',team:'DAL',age:32,val:38,adp:86},
  {name:"Kyle Pitts Sr.",pos:'TE',team:'ATL',age:25,val:52,adp:87},
  {name:"Chuba Hubbard",pos:'RB',team:'CAR',age:27,val:30,adp:88},
  {name:"Blake Corum",pos:'RB',team:'LAR',age:23,val:38,adp:89},
  {name:"Michael Wilson",pos:'WR',team:'ARI',age:24,val:53,adp:90},
  {name:"Jakobi Meyers",pos:'WR',team:'JAC',age:28,val:47,adp:91},
  {name:"Ricky Pearsall",pos:'WR',team:'SF',age:24,val:53,adp:92},
  {name:"Tony Pollard",pos:'RB',team:'TEN',age:28,val:24,adp:93},
  {name:"Patrick Mahomes II",pos:'QB',team:'KC',age:30,val:38,adp:94},
  {name:"Brock Purdy",pos:'QB',team:'SF',age:25,val:50,adp:95},
  {name:"Jordan Addison",pos:'WR',team:'MIN',age:23,val:61,adp:96},
  {name:"Michael Pittman Jr.",pos:'WR',team:'PIT',age:27,val:53,adp:98},
  {name:"Bo Nix",pos:'QB',team:'DEN',age:24,val:50,adp:99},
  {name:"Wan'Dale Robinson",pos:'WR',team:'TEN',age:24,val:28,adp:100},
  {name:"Matthew Stafford",pos:'QB',team:'LAR',age:37,val:38,adp:101},
  {name:"Parker Washington",pos:'WR',team:'JAC',age:25,val:53,adp:102},
  {name:"Aaron Jones Sr.",pos:'RB',team:'MIN',age:30,val:18,adp:103},
  {name:"Dalton Kincaid",pos:'TE',team:'BUF',age:25,val:52,adp:104},
  {name:"J.K. Dobbins",pos:'RB',team:'DEN',age:26,val:56,adp:105},
  {name:"Oronde Gadsden II",pos:'TE',team:'LAC',age:25,val:52,adp:106},
  {name:"Quentin Johnston",pos:'WR',team:'LAC',age:23,val:36,adp:107},
  {name:"Zach Charbonnet",pos:'RB',team:'SEA',age:25,val:30,adp:108},
  {name:"Jacory Croskey-Merritt",pos:'RB',team:'WAS',age:22,val:38,adp:109},
  {name:"Jake Ferguson",pos:'TE',team:'DAL',age:25,val:52,adp:110},
  {name:"James Conner",pos:'RB',team:'ARI',age:29,val:24,adp:111},
  {name:"Woody Marks",pos:'RB',team:'HOU',age:24,val:30,adp:112},
  {name:"Dallas Goedert",pos:'TE',team:'PHI',age:30,val:40,adp:115},
  {name:"Kyler Murray",pos:'QB',team:'MIN',age:27,val:50,adp:116},
  {name:"Stefon Diggs",pos:'WR',team:'FA',age:31,val:41,adp:117},
  {name:"Kenneth Gainwell",pos:'RB',team:'TB',age:25,val:30,adp:118},
  {name:"Jayden Reed",pos:'WR',team:'GB',age:25,val:28,adp:120},
  {name:"Jauan Jennings",pos:'WR',team:'FA',age:27,val:53,adp:121},
  {name:"Baker Mayfield",pos:'QB',team:'TB',age:30,val:38,adp:123},
  {name:"Khalil Shakir",pos:'WR',team:'BUF',age:25,val:53,adp:125},
  {name:"Jordan Mason",pos:'RB',team:'MIN',age:25,val:30,adp:126},
  {name:"Travis Kelce",pos:'TE',team:'KC',age:36,val:40,adp:128},
  {name:"Tyrone Tracy Jr.",pos:'RB',team:'NYG',age:24,val:30,adp:129},
  {name:"Rachaad White",pos:'RB',team:'WAS',age:26,val:30,adp:130},
  {name:"Alvin Kamara",pos:'RB',team:'NO',age:30,val:44,adp:131},
  {name:"Braelon Allen",pos:'RB',team:'NYJ',age:21,val:38,adp:133},
  {name:"Juwan Johnson",pos:'TE',team:'NO',age:25,val:52,adp:134},
  {name:"Jadarian Price",pos:'RB',team:'FA',age:25,val:30,adp:135},
  {name:"Romeo Doubs",pos:'WR',team:'NE',age:25,val:28,adp:137},
  {name:"Hunter Henry",pos:'TE',team:'NE',age:31,val:40,adp:138},
  {name:"Dylan Sampson",pos:'RB',team:'CLE',age:25,val:30,adp:139},
  {name:"Travis Hunter",pos:'WR',team:'JAC',age:22,val:61,adp:142},
  {name:"Tyjae Spears",pos:'RB',team:'TEN',age:24,val:30,adp:143},
  {name:"Brenton Strange",pos:'TE',team:'JAC',age:25,val:52,adp:144},
  {name:"Deebo Samuel Sr.",pos:'WR',team:'FA',age:29,val:22,adp:145},
  {name:"George Kittle",pos:'TE',team:'SF',age:31,val:66,adp:146},
  {name:"Isiah Pacheco",pos:'RB',team:'DET',age:26,val:30,adp:147},
  {name:"Brandon Aiyuk",pos:'WR',team:'SF',age:27,val:53,adp:148},
  {name:"Houston Texans",pos:'DST',team:'HOU',age:25,val:18,adp:157},
  {name:"Denzel Boston",pos:'WR',team:'FA',age:25,val:28,adp:159},
  {name:"Brian Robinson Jr.",pos:'RB',team:'ATL',age:25,val:30,adp:160},
  {name:"Mark Andrews",pos:'TE',team:'BAL',age:30,val:40,adp:162},
  {name:"Jonathon Brooks",pos:'RB',team:'CAR',age:22,val:38,adp:165},
  {name:"Denver Broncos",pos:'DST',team:'DEN',age:25,val:18,adp:170},
  {name:"Seattle Seahawks",pos:'DST',team:'SEA',age:25,val:18,adp:173},
  {name:"Los Angeles Rams",pos:'DST',team:'LAR',age:25,val:18,adp:176},
  {name:"Philadelphia Eagles",pos:'DST',team:'PHI',age:25,val:18,adp:178},
  {name:"Minnesota Vikings",pos:'DST',team:'MIN',age:25,val:18,adp:181},
  {name:"Brandon Aubrey",pos:'K',team:'DAL',age:31,val:10,adp:184},
  {name:"Ka'imi Fairbairn",pos:'K',team:'HOU',age:33,val:10,adp:191},
  {name:"Cam Little",pos:'K',team:'JAC',age:25,val:12,adp:193},
  {name:"Cameron Dicker",pos:'K',team:'LAC',age:28,val:10,adp:194},
  {name:"Jason Myers",pos:'K',team:'SEA',age:34,val:10,adp:201},
  {name:"Tyler Loop",pos:'K',team:'BAL',age:25,val:12,adp:207},
  {name:"Joe Mixon",pos:'RB',team:'FA',age:29,val:24,adp:230},
  {name:"Justice Hill",pos:'RB',team:'BAL',age:25,val:30,adp:298}
];;

// ---- State ----
const tradeState = { a: [], b: [] };

// ---- Keeper Lookup ----
// Build normalized name → {cost, pos} map from LEAGUE_DATA rosters
const KEEPER_LOOKUP = (function() {
  const map = {};
  try {
    Object.values(LEAGUE_DATA.rosters).forEach(roster => {
      roster.forEach(p => {
        const raw = p.val2026;
        const cost = (raw && raw !== 'TBD') ? parseInt(raw) : null;
        if (p.player) map[p.player.trim().toLowerCase()] = { cost, pos: p.pos };
      });
    });
  } catch(e) {}
  return map;
})();

// ---- Tier-based auction values from MSUFFL historical data (2022–2025) ----
// Each tier: [expectedValue, low, high] — derived from actual league auction results
const AUCTION_TIERS = {
  SuperStud: [81, 65, 95],  // Elite RB or WR (Saquon, Jefferson, Chase-level)
  RBStud:    [51, 40, 62],  // Premium RBs  (Gibbs, Achane, Taylor)
  WRStud:    [47, 40, 65],  // Premium WRs  (Amon-Ra, Nabers, Wilson)
  QBStud:    [17, 15, 18],  // Top QB       (Lamar, Allen, Hurts)
  TEStud:    [30, 13, 48],  // Top TE       (Bowers, McBride)
  RBStarter: [29, 16, 40],  // Starting RBs (Cook, Jacobs, White)
  WRStarter: [22, 14, 37],  // Starting WRs (Higgins, Olave, Waddle)
  QBStarter: [ 6,  4, 15],  // Starting QBs (Love, Purdy, Dak)
  TEStarter: [ 7,  4, 13],  // Starting TEs (Ferguson, Njoku, Pitts)
  RBDepth:   [ 4,  1, 13],  // Bench RBs
  WRDepth:   [ 5,  1, 14],  // Bench WRs
  QBDepth:   [ 2,  1,  4],  // Bench QBs
  TEDepth:   [ 2,  1,  4],  // Bench TEs
  K:         [ 2,  1,  5],  // Kicker
  DST:       [ 3,  1, 10],  // Defense
};

// Assign a tier based on ADP + position
// Thresholds calibrated against MSUFFL historical auction picks
function getAuctionTier(adp, pos) {
  if (pos === 'RB') {
    if (adp <= 8)  return 'SuperStud';  // Bijan, CMC, Gibbs, Hall
    if (adp <= 20) return 'RBStud';     // Achane, Saquon, Taylor, Kyren
    if (adp <= 58) return 'RBStarter';  // Cook, Jacobs, White, Swift
    return 'RBDepth';
  }
  if (pos === 'WR') {
    if (adp <= 4)  return 'SuperStud';  // Chase, Lamb
    if (adp <= 35) return 'WRStud';     // Jefferson, Amon-Ra, Puka, Nabers, Harrison
    if (adp <= 78) return 'WRStarter';  // Higgins, Olave, Waddle, Flowers
    return 'WRDepth';
  }
  if (pos === 'QB') {
    if (adp <= 30) return 'QBStud';     // Lamar, Allen, Hurts, Stroud, Mahomes
    if (adp <= 68) return 'QBStarter';  // Love, Purdy, Dak, Tua
    return 'QBDepth';
  }
  if (pos === 'TE') {
    if (adp <= 30) return 'TEStud';     // Bowers, McBride
    if (adp <= 95) return 'TEStarter';  // LaPorta, Ferguson, Njoku, Pitts
    return 'TEDepth';
  }
  if (pos === 'K')   return 'K';
  if (pos === 'DST') return 'DST';
  return 'WRDepth';
}

function estimateFairAuctionValue(adp, pos) {
  return AUCTION_TIERS[getAuctionTier(adp, pos)][0];
}

function getAuctionTierLabel(name, adp, pos) {
  const sp = SP_DATA[name];
  if (sp && sp.t) return sp.t;
  return getAuctionTier(adp, pos).replace(/([A-Z])/g, ' $1').trim();
}

// Next-year escalation: greater of 20% or +$4
function nextYearCost(cost) {
  if (!cost && cost !== 0) return null;
  return Math.max(Math.round(cost * 1.20), cost + 4);
}

// Look up a player's 2026 keeper cost (or estimate if not in league)
function getKeeperCost(player) {
  // Try exact match first, then fuzzy (handles ALL-CAPS names like "JA'MARR CHASE")
  const key = player.name.toLowerCase();
  let entry = KEEPER_LOOKUP[key];
  if (!entry) {
    // Try partial match (last name)
    const lastName = key.split(' ').slice(-1)[0];
    entry = Object.entries(KEEPER_LOOKUP).find(([k]) => k.endsWith(lastName) && k.includes(key.split(' ')[0]))?.[1];
  }
  if (entry && entry.cost !== null) return entry.cost;
  // Not in this league — estimate based on position + ADP
  return estimateDefaultKeeperCost(player.name, player.adp, player.pos);
}

// For players not on any roster, estimate a reasonable keeper baseline
// QBs/TEs kept at a bigger discount (structurally cheaper position); RBs/WRs closer to market
function estimateDefaultKeeperCost(name, adp, pos) {
  const sp = SP_DATA[name];
  const fair = sp ? sp.f : estimateFairAuctionValue(adp, pos);
  const discount = { QB: 0.65, TE: 0.70, RB: 0.80, WR: 0.78, K: 0.90, DST: 0.90 };
  return Math.max(1, Math.round(fair * (discount[pos] || 0.75)));
}

// Contract surplus: what the player is "worth" vs what you pay to keep them
// Uses per-player SP_DATA fair value when available; falls back to tier-based estimate
function calcSurplus(player) {
  const sp = SP_DATA[player.name];
  const fair = sp ? sp.f : estimateFairAuctionValue(player.adp, player.pos);
  // For keeper cost: use SP_DATA entry if it has one, else look up roster/estimate
  const spCost = sp && sp.kc !== null ? sp.kc : null;
  const cost = spCost !== null ? spCost : getKeeperCost(player);
  return { cost, fair, surplus: Math.round(fair - cost) };
}

// ---- Helpers ----
function calcRedraftScore(adp) {
  return Math.max(0, Math.round(((200 - adp) / 199) * 99));
}
function calcVal(player) {
  // Base: 50% dynasty + 50% redraft
  const base = Math.round(player.val * 0.5 + calcRedraftScore(player.adp) * 0.5);
  // Contract surplus bonus: each $1 of surplus ≈ +0.4 pts, capped at ±18
  const { surplus } = calcSurplus(player);
  const bonus = Math.max(-18, Math.min(18, Math.round(surplus * 0.4)));
  return Math.max(1, base + bonus);
}
function calcWinNow(player) {
  const ageBonus = Math.max(-10, Math.min(10, (player.age - 26) * 2));
  return Math.min(100, Math.round(calcRedraftScore(player.adp) + ageBonus));
}
function calcRebuild(player) {
  const youthBonus = Math.max(-10, Math.min(15, (28 - player.age) * 2.5));
  return Math.min(100, Math.round(player.val + youthBonus));
}
function totalSide(side) {
  if (!side.length) return 0;
  return side.reduce((s, p) => s + calcVal(p), 0);
}
function totalSurplus(side) {
  if (!side.length) return 0;
  return side.reduce((s, p) => s + calcSurplus(p).surplus, 0);
}
function avgWinNow(side) {
  if (!side.length) return 0;
  return Math.round(side.reduce((s, p) => s + calcWinNow(p), 0) / side.length);
}
function avgRebuild(side) {
  if (!side.length) return 0;
  return Math.round(side.reduce((s, p) => s + calcRebuild(p), 0) / side.length);
}
function avgAge(side) {
  if (!side.length) return 0;
  return (side.reduce((s, p) => s + p.age, 0) / side.length).toFixed(1);
}

// ---- Search ----
function buildDropdown(query, side) {
  const ddId = `dropdown-${side}`;
  const dd = document.getElementById(ddId);
  if (!query || query.length < 2) { dd.classList.remove('open'); return; }
  const q = query.toLowerCase();
  const existing = tradeState[side].map(p => p.name);
  const matches = TP.filter(p => p.name.toLowerCase().includes(q) && !existing.includes(p.name)).slice(0, 10);
  if (!matches.length) { dd.innerHTML = '<div class="player-dropdown-item"><span class="dd-name" style="color:var(--muted)">No players found</span></div>'; dd.classList.add('open'); return; }
  dd.innerHTML = matches.map(p => {
    const { cost, surplus } = calcSurplus(p);
    const surplusStr = surplus >= 0 ? `<span style="color:var(--green)">+$${surplus}</span>` : `<span style="color:var(--red)">-$${Math.abs(surplus)}</span>`;
    return `<div class="player-dropdown-item" data-name="${p.name}" data-side="${side}">
      <span class="pos-badge pos-${p.pos}" style="font-size:0.7rem;padding:0.1rem 0.4rem;border-radius:4px">${p.pos}</span>
      <span class="dd-name">${p.name}</span>
      <span class="dd-meta">${p.team} · $${cost} keeper</span>
      <span class="dd-val">${calcVal(p)} ${surplusStr}</span>
    </div>`;
  }).join('');
  dd.classList.add('open');
  dd.querySelectorAll('.player-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const player = TP.find(p => p.name === item.dataset.name);
      if (player) addPlayer(player, item.dataset.side);
    });
  });
}

function addPlayer(player, side) {
  tradeState[side].push(player);
  document.getElementById(`search-${side}`).value = '';
  document.getElementById(`dropdown-${side}`).classList.remove('open');
  renderSide(side);
  updateAnalyzeBtn();
}

function removePlayer(name, side) {
  tradeState[side] = tradeState[side].filter(p => p.name !== name);
  renderSide(side);
  updateAnalyzeBtn();
  // Hide results if trade changes after analysis
  document.getElementById('trade-results').classList.remove('visible');
}

function renderSide(side) {
  const listEl = document.getElementById(`players-${side}`);
  const totalEl = document.getElementById(`total-${side}`);
  const players = tradeState[side];
  if (!players.length) {
    listEl.innerHTML = '<div class="trade-empty-msg">No players added yet</div>';
    totalEl.textContent = '—';
    return;
  }
  listEl.innerHTML = players.map(p => {
    const { cost, fair, surplus } = calcSurplus(p);
    const surplusLabel = surplus >= 0
      ? `<span style="color:var(--green);font-size:0.72rem;font-family:'DM Mono',monospace">+$${surplus} surplus</span>`
      : `<span style="color:var(--red);font-size:0.72rem;font-family:'DM Mono',monospace">-$${Math.abs(surplus)} over</span>`;
    return `<div class="trade-player-chip">
      <span class="pos-badge pos-${p.pos}" style="font-size:0.7rem;padding:0.1rem 0.4rem;border-radius:4px">${p.pos}</span>
      <span class="chip-name">${p.name}</span>
      <span class="chip-meta">${p.team} · ${p.age}yo · <span style="color:var(--muted)">$${cost} keeper</span></span>
      ${surplusLabel}
      <span class="chip-val">${calcVal(p)}</span>
      <button class="chip-remove" data-name="${p.name}" data-side="${side}" title="Remove">×</button>
    </div>`;
  }).join('');
  listEl.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', () => removePlayer(btn.dataset.name, btn.dataset.side));
  });
  const tot = totalSide(players);
  totalEl.textContent = tot;
}

function updateAnalyzeBtn() {
  const btn = document.getElementById('analyze-btn');
  btn.disabled = !(tradeState.a.length > 0 && tradeState.b.length > 0);
}

// ---- Analysis ----
function analyzeTrade() {
  const a = tradeState.a, b = tradeState.b;
  const totA = totalSide(a), totB = totalSide(b);
  const wnA = avgWinNow(a), wnB = avgWinNow(b);
  const rbA = avgRebuild(a), rbB = avgRebuild(b);
  const ageA = avgAge(a), ageB = avgAge(b);
  const maxTot = Math.max(totA, totB, 1);
  const diff = totA - totB;
  const diffPct = Math.round(Math.abs(diff) / ((totA + totB) / 2) * 100);

  // ---- Value Bars ----
  const vbEl = document.getElementById('value-bars');
  const aIsWinner = totA >= totB;
  vbEl.innerHTML = `
    <div class="tvb-row">
      <div class="tvb-label"><span class="tvb-name">Team A Gets</span><span class="tvb-score">${totA} pts</span></div>
      <div class="tvb-bar-bg"><div class="tvb-bar-fill${aIsWinner ? '' : ' loser'}" style="width:${Math.round(totA/maxTot*100)}%"></div></div>
    </div>
    <div class="tvb-row">
      <div class="tvb-label"><span class="tvb-name">Team B Gets</span><span class="tvb-score">${totB} pts</span></div>
      <div class="tvb-bar-bg"><div class="tvb-bar-fill${!aIsWinner ? '' : ' loser'}" style="width:${Math.round(totB/maxTot*100)}%"></div></div>
    </div>
    <div class="tvb-diff"><strong>${diffPct < 5 ? 'Even trade' : `Team ${diff > 0 ? 'A' : 'B'} gets +${diffPct}% more value`}</strong> · ${Math.abs(diff)} point differential</div>`;

  // ---- Score Grid ----
  const surpA = totalSurplus(a), surpB = totalSurplus(b);
  const sgEl = document.getElementById('score-grid');
  const wnWinner = wnA >= wnB ? 'A' : 'B';
  const rbWinner = rbA >= rbB ? 'A' : 'B';
  const contractWinner = surpA >= surpB ? 'A' : 'B';
  const fmtSurplus = v => v >= 0 ? `+$${v}` : `-$${Math.abs(v)}`;
  sgEl.innerHTML = `
    <div class="trade-score-card">
      <div class="tsc-title">Win-Now Score</div>
      <div class="tsc-row"><span class="tsc-team">Team A gets</span><span class="tsc-val ${wnWinner==='A'?'win':'lose'}">${wnA}</span></div>
      <div class="tsc-row"><span class="tsc-team">Team B gets</span><span class="tsc-val ${wnWinner==='B'?'win':'lose'}">${wnB}</span></div>
      <div><span class="tsc-badge ${wnWinner==='A'?'green':'red'}">Team ${wnWinner} wins now</span></div>
    </div>
    <div class="trade-score-card">
      <div class="tsc-title">Dynasty/Rebuild Score</div>
      <div class="tsc-row"><span class="tsc-team">Team A gets</span><span class="tsc-val ${rbWinner==='A'?'win':'lose'}">${rbA}</span></div>
      <div class="tsc-row"><span class="tsc-team">Team B gets</span><span class="tsc-val ${rbWinner==='B'?'win':'lose'}">${rbB}</span></div>
      <div><span class="tsc-badge ${rbWinner==='A'?'green':'red'}">Team ${rbWinner} better rebuild</span></div>
    </div>
    <div class="trade-score-card">
      <div class="tsc-title">Contract Surplus</div>
      <div class="tsc-row"><span class="tsc-team">Team A gets</span><span class="tsc-val ${contractWinner==='A'?'win':'lose'}">${fmtSurplus(surpA)}</span></div>
      <div class="tsc-row"><span class="tsc-team">Team B gets</span><span class="tsc-val ${contractWinner==='B'?'win':'lose'}">${fmtSurplus(surpB)}</span></div>
      <div><span class="tsc-badge ${contractWinner==='A'?'green':'red'}">Team ${contractWinner} better deals</span></div>
    </div>
    <div class="trade-score-card">
      <div class="tsc-title">Avg Age</div>
      <div class="tsc-row"><span class="tsc-team">Team A gets</span><span class="tsc-val neutral">${ageA}</span></div>
      <div class="tsc-row"><span class="tsc-team">Team B gets</span><span class="tsc-val neutral">${ageB}</span></div>
      <div><span class="tsc-badge yellow">${parseFloat(ageA) < parseFloat(ageB) ? 'A' : 'B'} gets younger</span></div>
    </div>`;

  // ---- Positional Notes ----
  const pnEl = document.getElementById('pos-needs');
  const notes = buildPosNotes(a, b);
  pnEl.innerHTML = notes.map(n => `<div class="tpn-item"><span class="tpn-icon">${n.icon}</span><span class="tpn-text">${n.text}</span></div>`).join('') || '<div class="tpn-item"><span class="tpn-text" style="color:var(--muted)">No notable positional concerns.</span></div>';

  // ---- Verdict ----
  renderVerdict(a, b, totA, totB, wnA, wnB, rbA, rbB, diffPct, ageA, ageB, surpA, surpB);

  document.getElementById('trade-results').classList.add('visible');
  document.getElementById('trade-results').scrollIntoView({behavior:'smooth', block:'start'});
}

function buildPosNotes(a, b) {
  const notes = [];
  const posCount = (side) => side.reduce((m, p) => { m[p.pos] = (m[p.pos]||0)+1; return m; }, {});
  const pA = posCount(a), pB = posCount(b);

  // TE premium note
  if (a.some(p=>p.pos==='TE')) notes.push({icon:'🔒', text:'<strong>TE Premium:</strong> Team A is giving up TE production — tight end scarcity makes this costly in standard leagues.'});
  if (b.some(p=>p.pos==='TE')) notes.push({icon:'🔒', text:'<strong>TE Premium:</strong> Team B is giving up TE production — tight ends are the scarcest position in fantasy.'});

  // Multi-player at same position
  Object.entries(pA).forEach(([pos, cnt]) => { if (cnt >= 2) notes.push({icon:'⚠️', text:`Team A is giving up <strong>${cnt} ${pos}s</strong> — consider whether the depth hit is worth it.`}); });
  Object.entries(pB).forEach(([pos, cnt]) => { if (cnt >= 2) notes.push({icon:'⚠️', text:`Team B is giving up <strong>${cnt} ${pos}s</strong> — consider whether the depth hit is worth it.`}); });

  // Age-related notes
  const youngA = a.filter(p => p.age <= 23);
  const youngB = b.filter(p => p.age <= 23);
  if (youngA.length) notes.push({icon:'📈', text:`Team A includes <strong>${youngA.map(p=>p.name).join(', ')}</strong> (${youngA.length === 1 ? 'age' : 'ages'} ≤23) — high upside dynasty assets.`});
  if (youngB.length) notes.push({icon:'📈', text:`Team B includes <strong>${youngB.map(p=>p.name).join(', ')}</strong> (${youngB.length === 1 ? 'age' : 'ages'} ≤23) — high upside dynasty assets.`});

  // Aging veterans
  const oldA = a.filter(p => p.age >= 31);
  const oldB = b.filter(p => p.age >= 31);
  if (oldA.length) notes.push({icon:'⏳', text:`<strong>${oldA.map(p=>p.name).join(', ')}</strong> (age ${oldA.map(p=>p.age).join('/')}) — production may decline; better for win-now contexts.`});
  if (oldB.length) notes.push({icon:'⏳', text:`<strong>${oldB.map(p=>p.name).join(', ')}</strong> (age ${oldB.map(p=>p.age).join('/')}) — production may decline; better for win-now contexts.`});

  // QB note
  const qbA = a.filter(p=>p.pos==='QB'), qbB = b.filter(p=>p.pos==='QB');
  if (qbA.length && !qbB.length) notes.push({icon:'🏈', text:'<strong>QB-heavy trade:</strong> Team A is moving a QB. In standard ESPN leagues, QB value is often undervalued — weigh this carefully.'});
  if (qbB.length && !qbA.length) notes.push({icon:'🏈', text:'<strong>QB-heavy trade:</strong> Team B is moving a QB. In standard ESPN leagues, quarterback value may be discounted.'});

  return notes.slice(0, 5);
}

function renderVerdict(a, b, totA, totB, wnA, wnB, rbA, rbB, diffPct, ageA, ageB, surpA, surpB) {
  const el = document.getElementById('trade-verdict');
  const aWins = totA > totB;
  const isClose = diffPct < 7;
  const winner = aWins ? 'A' : 'B';
  const loser = aWins ? 'B' : 'A';
  const winSide = aWins ? a : b;
  const loseSide = aWins ? b : a;
  const topGet = winSide.sort((x,y) => calcVal(y)-calcVal(x))[0];
  const topGive = loseSide.sort((x,y) => calcVal(y)-calcVal(x))[0];

  let headline, summary, line2, line3;
  const tags = [];

  if (isClose) {
    headline = `<span class="v-winner">Even Trade</span>`;
    summary = `This trade is essentially a wash on paper — both sides are getting comparable value. The devil is in the details.`;
    tags.push({label:'Fair Value', cls:'pos'});
  } else if (diffPct < 18) {
    headline = `<span class="v-winner">Team ${winner}</span> Wins This Trade`;
    summary = `Team ${winner} comes out ahead by <strong>~${diffPct}%</strong>, landing better overall value in this deal.`;
    tags.push({label:`Team ${winner} Wins`, cls:'pos'});
    tags.push({label:`Team ${loser} Overpays`, cls:'neg'});
  } else {
    headline = `<span class="v-winner">Team ${winner}</span> Significantly Wins`;
    summary = `Team ${winner} wins this trade convincingly — a <strong>${diffPct}%</strong> value gap is substantial. Team ${loser} should look for a better return.`;
    tags.push({label:`Team ${winner} Big Win`, cls:'pos'});
    tags.push({label:`Imbalanced`, cls:'neg'});
  }

  // Win-now vs rebuild context
  const winNowGap = Math.abs(wnA - wnB);
  const rebuildGap = Math.abs(rbA - rbB);
  if (winNowGap > 10) line2 = `<strong>Win-now angle:</strong> Team ${wnA > wnB ? 'A' : 'B'} gets a bigger boost for this season — if you're in win-now mode, that's important context.`;
  if (rebuildGap > 10) line3 = `<strong>Dynasty/rebuild angle:</strong> Team ${rbA > rbB ? 'A' : 'B'} acquires better long-term assets. If you're rebuilding, this trade ${rbA > rbB && aWins ? 'works on both counts' : 'may be the right call despite the value gap'}.`;

  // Contract surplus context
  const contractDiff = Math.abs(surpA - surpB);
  const contractWinner = surpA >= surpB ? 'A' : 'B';
  let contractLine = '';
  if (contractDiff >= 5) {
    const topSurplusPlayer = (contractWinner === 'A' ? a : b).reduce((best, p) => calcSurplus(p).surplus > calcSurplus(best).surplus ? p : best);
    const { cost, fair, surplus } = calcSurplus(topSurplusPlayer);
    // Note the position pricing dynamic
    const posNote = ['QB','TE'].includes(topSurplusPlayer.pos)
      ? `${topSurplusPlayer.pos}s are typically cheaper to keep`
      : `${topSurplusPlayer.pos}s command higher keeper prices`;
    contractLine = `<strong>Contract value:</strong> Team ${contractWinner} acquires better keeper deals — notably <strong>${topSurplusPlayer.name}</strong> at $${cost}/yr vs. a fair value of ~$${fair} (${posNote}). That $${surplus} surplus compounds as costs escalate each year.`;
  }

  // Age context
  const youngWinner = parseFloat(ageA) < parseFloat(ageB) ? 'A' : 'B';
  if (parseFloat(ageA) !== parseFloat(ageB)) {
    tags.push({label:`Team ${youngWinner} Gets Younger`, cls:'warn'});
  }
  if (contractDiff >= 5) tags.push({label:`Team ${contractWinner} Better Contracts`, cls: contractWinner === winner ? 'pos' : 'warn'});
  if (topGet) tags.push({label:topGet.pos, cls:'pos'});
  if (topGet && topGet.age <= 23) tags.push({label:'Youth Upside', cls:'pos'});

  let html = `
    <div class="verdict-header">⚖ AI Trade Verdict</div>
    <div class="verdict-headline">${headline}</div>
    <div class="verdict-body">
      <p>${summary}</p>
      ${line2 ? `<p>${line2}</p>` : ''}
      ${line3 ? `<p>${line3}</p>` : ''}
      ${contractLine ? `<p>${contractLine}</p>` : ''}`;

  if (topGet) html += `<p><strong>Key player:</strong> ${topGet.name} (${topGet.pos}, ${topGet.team}) is the headliner — valued at <strong>${calcVal(topGet)} pts</strong>, keeper cost <strong>$${getKeeperCost(topGet)}</strong> with a dynasty score of ${topGet.val}/100.</p>`;

  html += `</div><div class="verdict-tags">${tags.map(t=>`<span class="verdict-tag ${t.cls}">${t.label}</span>`).join('')}</div>`;
  el.innerHTML = html;
}

// ---- Event Listeners ----
['a','b'].forEach(side => {
  const input = document.getElementById(`search-${side}`);
  const dd = document.getElementById(`dropdown-${side}`);
  input.addEventListener('input', e => buildDropdown(e.target.value, side));
  input.addEventListener('focus', e => { if (e.target.value.length >= 2) buildDropdown(e.target.value, side); });
  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dd.contains(e.target)) dd.classList.remove('open');
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') dd.classList.remove('open');
  });
});

document.getElementById('analyze-btn').addEventListener('click', analyzeTrade);

document.getElementById('trade-reset-btn').addEventListener('click', () => {
  tradeState.a = []; tradeState.b = [];
  renderSide('a'); renderSide('b');
  updateAnalyzeBtn();
  document.getElementById('trade-results').classList.remove('visible');
  window.scrollTo({top: document.getElementById('page-tradeanalyzer').offsetTop - 80, behavior:'smooth'});
});

// Expose shared valuation data + utility functions for roster analysis
window._MSU = {
  SP_DATA, TP, KEEPER_LOOKUP,
  calcVal, calcWinNow, calcRebuild, calcSurplus, calcRedraftScore,
  estimateFairAuctionValue, estimateDefaultKeeperCost, totalSide
};

})(); // end trade analyzer IIFE


// ===== SAVE ENGINE (Phase 2) =====
(function() {
  const REPO_OWNER = 'Bradengeraldo';
  const REPO_NAME  = 'msuffl';
  const FILES      = ['leagueData.js'];   // data now lives in its own file — commits are small and never touch markup/code
  // Last human-readable failure reason from saveData, so the Phase 5 overlay (which
  // only gets a true/false result) can show the REAL cause instead of always
  // guessing "check your token" — e.g. "no changes to save" has nothing to do with
  // auth and telling someone to re-check their token for it is actively misleading.
  let _lastSaveError = '';

  // ── Fetch file from GitHub (returns {content, sha}) ──────────────────────
  async function fetchFile(filename) {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`;
    const resp = await fetch(url, {
      headers: {
        'Authorization': `token ${window.commMode.getToken()}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!resp.ok) throw new Error(`GitHub fetch failed: ${resp.status} ${resp.statusText}`);
    const data = await resp.json();
    // GitHub returns base64 content with newlines — strip them before decoding
    const raw = data.content.replace(/\n/g, '');
    return { content: decodeURIComponent(escape(atob(raw))), sha: data.sha };
  }

  // ── Commit updated file to GitHub ─────────────────────────────────────────
  async function commitFile(filename, content, sha, message) {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`;
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${window.commMode.getToken()}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        content: btoa(unescape(encodeURIComponent(content))),
        sha
      })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`Commit failed: ${resp.status} — ${err.message || resp.statusText}`);
    }
    return resp.json();
  }

  // ── Replace a JS data block using bracket counting ────────────────────────
  // Handles deeply nested objects/arrays regardless of formatting
  function replaceDataBlock(html, varName, newData) {
    const declRe = new RegExp(`(?:const|var|let)\\s+${varName}\\s*=\\s*`);
    const match  = declRe.exec(html);
    if (!match) throw new Error(`Data block not found: ${varName}`);

    const valueStart = match.index + match[0].length;
    const opener = html[valueStart];
    const closer = opener === '{' ? '}' : ']';

    let depth = 0, i = valueStart, inStr = false, strCh = '';
    while (i < html.length) {
      const ch = html[i];
      if (inStr) {
        if (ch === '\\') { i += 2; continue; }
        if (ch === strCh) inStr = false;
      } else {
        if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; }
        else if (ch === opener) depth++;
        else if (ch === closer) { depth--; if (depth === 0) { i++; break; } }
      }
      i++;
    }

    return html.slice(0, valueStart) + JSON.stringify(newData) + html.slice(i);
  }

  // ── Toast notification ─────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    let el = document.getElementById('comm-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'comm-toast';
      Object.assign(el.style, {
        position: 'fixed', bottom: '68px', left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--surface2)',
        border: '1px solid var(--border-bright)',
        color: 'var(--text)',
        padding: '0.6rem 1.2rem',
        borderRadius: '8px',
        fontSize: '0.85rem',
        fontWeight: '600',
        zIndex: '500',
        transition: 'opacity 0.3s',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
      });
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.color  = type === 'error' ? 'var(--red)' : 'var(--green)';
    el.style.borderColor = type === 'error' ? 'var(--red)' : 'var(--border-bright)';
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 3500);
  }

  // ── Main save function ─────────────────────────────────────────────────────
  // varName: JS variable name to replace (e.g. 'LEAGUE_DATA')
  // newData: the updated JS object
  // message: git commit message
  async function saveData(varName, newData, message) {
    _lastSaveError = '';
    if (!window.commMode.isUnlocked() || !window.commMode.getToken()) {
      _lastSaveError = 'Not logged in as commissioner';
      showToast(_lastSaveError, 'error'); return false;
    }
    showToast('Saving…');
    try {
      // ── Conflict guard: warn if live data changed since this page last synced ──
      try {
        const vRes = await fetch('https://msuffl-default-rtdb.firebaseio.com/league_data/_version.json?t=' + Date.now());
        if (vRes.ok) {
          const remote = await vRes.json();
          const seen = window.__fbVersionSeen || 0;
          if (remote && seen && remote > seen) {
            if (!confirm('⚠️ The live database changed since this page last synced — someone else (or another tab) may have saved.\n\nSaving now will overwrite their changes. Continue?')) {
              _lastSaveError = 'Save cancelled';
              showToast(_lastSaveError, 'error'); return false;
            }
          }
        }
      } catch(e) { /* offline — proceed */ }

      for (const file of FILES) {
        const { content, sha } = await fetchFile(file);
        const updated = replaceDataBlock(content, varName, newData);
        // Not a failure — nothing to commit. Thrown so it short-circuits the loop
        // and is reported below, but tagged so callers/the overlay don't read it
        // as "something is broken" (e.g. bad token) when nothing changed at all.
        if (updated === content) { const e = new Error('No changes to save — edit something first'); e.noOp = true; throw e; }
        await commitFile(file, updated, sha, message || `Commissioner: update ${varName}`);
      }
      showToast('✓ Saved — site updates in ~30s');
      // Mirror LEAGUE_DATA to Firebase (authenticated) so all live viewers see fresh
      // data immediately, snapshot it for rollback, and bump the version counter.
      // Awaited (unlike before) so a failed mirror is surfaced instead of silently
      // leaving every other live viewer on stale data until the ~30s GitHub rebuild
      // completes and they happen to reload — the GitHub commit above still counts
      // as the save succeeding (it's the durable copy), this only warns about the
      // separate instant-update path.
      if (varName === 'LEAGUE_DATA' && window.fbSet) {
        const ts = Date.now();
        const mirrored = await window.fbSet('league_data/leagueData', JSON.stringify(newData));
        if (mirrored) {
          await window.fbSet('league_data/_version', ts);
          window.__fbVersionSeen = ts;
          if (window.fbSnapshot) window.fbSnapshot(newData, message);
        } else {
          showToast('⚠ Saved to GitHub, but the instant live-update push failed — other viewers won\'t see this until the site rebuilds (~30s) and they reload. Check you\'re still signed in as commissioner.', 'error');
        }
      }
      return true;
    } catch (err) {
      console.error('[commSave]', err);
      // Surface a helpful message for common failures
      let msg = err.message;
      if (err.noOp) {
        // leave msg as-is: "No changes to save — edit something first"
      } else if (msg.includes('401') || msg.includes('Bad credentials')) {
        msg = 'GitHub token invalid — log out and log back in with a fresh token';
      } else if (msg.includes('403') || msg.includes('not accessible')) {
        msg = 'GitHub token lacks write access — fine-grained token needs the msuffl repo selected with Contents: Read & write';
      } else if (msg.includes('404')) {
        msg = 'File not found in repo — make sure leagueData.js has been uploaded to GitHub';
      } else if (msg.includes('422')) {
        msg = 'Commit conflict — reload the page and try again';
      }
      _lastSaveError = msg;
      showToast(msg, 'error');
      return false;
    }
  }

  // ── Expose globally for Phase 3+ editors ──────────────────────────────────
  window.commSave = { saveData, showToast, fetchFile, commitFile, replaceDataBlock, getLastError: () => _lastSaveError };
})();
// ===== END SAVE ENGINE =====


// ===== ROSTER EDITOR (Phase 3a) =====
(function() {
  const POSITIONS = ['QB','RB','WR','TE','K','D/ST'];
  const CONTRACT_OPTIONS = ['N','Restricted FA','R1','R2','R3'];

  // ── Patch showTeamDetail to inject Edit button when commissioner is logged in ──
  const _orig = window.showTeamDetail;
  window.showTeamDetail = function(team) {
    _orig(team);
    if (window.commMode && window.commMode.isUnlocked()) {
      injectEditBtn(team);
    }
  };

  function injectEditBtn(team) {
    const content = document.getElementById('team-detail-content');
    if (!content || content.querySelector('.comm-edit-roster-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'comm-edit-roster-btn';
    btn.innerHTML = '✏️ Edit Roster';
    btn.onclick = () => openEditor(team);
    content.insertBefore(btn, content.firstChild);
  }

  // ── Open the editor for a team ─────────────────────────────────────────────
  function openEditor(team) {
    let draft = JSON.parse(JSON.stringify(LEAGUE_DATA.rosters[team] || []));

    const container = document.getElementById('team-detail-content');
    document.getElementById('team-detail-view').style.display = 'block';
    document.getElementById('rosters-list-view').style.display = 'none';

    // Baseline budget values (what the user sees before editing)
    const _bud        = (LEAGUE_DATA.budgets && LEAGUE_DATA.budgets[team]) || {};
    const _budget     = parseInt(_bud.budget)      || 200;
    const _storedKept = parseInt(_bud.totalKept)   || 0;
    const _storedCnt  = parseInt(_bud.playerCount) || draft.length;
    const _faab       = _bud.inSeasonFaab !== undefined ? parseInt(_bud.inSeasonFaab) : null;
    // Original val2025 sum so we can track the delta
    const _baseVal25  = draft.reduce((s, p) => s + (parseInt(p.val2026) || 0), 0);
    const _baseCnt    = draft.length; // frozen — draft mutates but this stays fixed

    function calcSummary() {
      const rows = document.querySelectorAll('#re-tbody tr');
      let curVal25 = 0, curCnt = 0;
      rows.forEach(row => {
        const n = row.querySelector('.re-name');
        const v = row.querySelector('.re-val26');
        if (!n || !n.value.trim()) return;
        curCnt++;
        curVal25 += parseInt(v ? v.value : '0') || 0;
      });
      const delta     = curVal25 - _baseVal25;
      const dispKept  = _storedKept + delta;
      const dispCnt   = _storedCnt  + (curCnt - _baseCnt);
      const remaining = _budget - dispKept;
      return { dispKept, dispCnt, remaining };
    }

    function updateSummary() {
      const { dispKept, dispCnt, remaining } = calcSummary();
      document.getElementById('rs-keepers').textContent = dispCnt;
      document.getElementById('rs-kept').textContent    = '$' + dispKept;
      const remEl = document.getElementById('rs-remaining');
      remEl.textContent = (remaining >= 0 ? '+' : '') + '$' + remaining;
      remEl.className   = 'rsval' + (remaining < 0 ? ' neg' : '');
      // In-Season FAAB is always Remaining + $25
      const el = document.getElementById('rs-faab');
      if (el) {
        const faabVal = remaining + 25;
        el.textContent = (faabVal >= 0 ? '+' : '') + '$' + faabVal;
        el.className   = 'rsval' + (faabVal < 0 ? ' neg' : '');
      }
    }

    function rowHtml(p, i) {
      const posOpts = POSITIONS.map(pos =>
        `<option value="${pos}" ${p.pos===pos?'selected':''}>${pos}</option>`
      ).join('');
      const isCustom  = p.rookieDeal && !CONTRACT_OPTIONS.includes(p.rookieDeal);
      const extraOpt  = isCustom ? `<option value="${escHtml(p.rookieDeal)}" selected>${escHtml(p.rookieDeal)}</option>` : '';
      const contOpts  = CONTRACT_OPTIONS.map(c =>
        `<option value="${c}" ${p.rookieDeal===c?'selected':''}>${c}</option>`
      ).join('');
      return `
        <tr>
          <td><input class="re-input re-name" value="${escHtml(p.player)}" placeholder="Player name" /></td>
          <td><select class="re-input re-pos" style="width:70px">${posOpts}</select></td>
          <td><select class="re-input re-contract mid">${extraOpt}${contOpts}</select></td>
          <td><input class="re-input narrow re-val25" value="${escHtml(String(p.val2025||'0'))}" placeholder="$" /></td>
          <td><input class="re-input narrow re-val26" value="${escHtml(String(p.val2026||'TBD'))}" placeholder="$" /></td>
          <td><button class="re-del-btn" data-i="${i}" title="Remove player">✕</button></td>
        </tr>`;
    }

    function render() {
      const faabHtml = _faab !== null
        ? `<div class="re-summary-stat"><span class="rsval" id="rs-faab">$0</span><span class="rslbl">In-Season FAAB</span></div>`
        : '';
      container.innerHTML = `
        <div class="comm-editor-bar">
          <span class="comm-editor-title">✏️ ${escHtml(team)}</span>
          <div class="comm-editor-btns">
            <button class="comm-btn-save" id="re-save">💾 Save Roster</button>
            <button class="comm-btn-lock" id="re-lock">🔓 Lock Keepers</button>
            <button class="comm-btn-cancel" id="re-cancel">Cancel</button>
          </div>
        </div>
        <div class="re-summary-bar">
          <div class="re-summary-stat"><span class="rsval">${_budget}</span><span class="rslbl">Budget</span></div>
          <div class="re-summary-stat"><span class="rsval" id="rs-kept">$0</span><span class="rslbl">Kept $</span></div>
          <div class="re-summary-stat"><span class="rsval" id="rs-remaining">$0</span><span class="rslbl">Remaining</span></div>
          <div class="re-summary-stat"><span class="rsval" id="rs-keepers">0</span><span class="rslbl">Keepers</span></div>
          ${faabHtml}
        </div>
        <table class="roster-edit-table">
          <thead><tr>
            <th style="width:36%">Player</th>
            <th style="width:8%">Pos</th>
            <th style="width:18%">Contract</th>
            <th style="width:10%">2025 $</th>
            <th style="width:10%">2026 $</th>
            <th style="width:8%"></th>
          </tr></thead>
          <tbody id="re-tbody">${draft.map((p, i) => rowHtml(p, i)).join('')}</tbody>
        </table>
        <button class="comm-add-row-btn" id="re-add">＋ Add Player</button>
      `;

      // Show correct initial values
      updateSummary();

      // Lock button initial state
      (function() {
        const locks = LEAGUE_DATA.keeperLocks || {};
        const btn = document.getElementById('re-lock');
        if (locks[team]) { btn.textContent = '🔒 Keepers Locked'; btn.classList.add('locked'); }
        btn.onclick = async () => {
          const lk = LEAGUE_DATA.keeperLocks || {};
          const wasLocked = !!lk[team];
          if (wasLocked) { delete lk[team]; } else { lk[team] = true; }
          LEAGUE_DATA.keeperLocks = lk;
          btn.textContent = lk[team] ? '🔒 Keepers Locked' : '🔓 Lock Keepers';
          btn.classList.toggle('locked', !!lk[team]);
          await window.commSave.saveData('LEAGUE_DATA', LEAGUE_DATA,
            `Commissioner: ${wasLocked ? 'unlock' : 'lock'} keepers for ${team}`);
        };
      })();


      // Live update on any input change
      document.getElementById('re-tbody').addEventListener('input', updateSummary);

      // Delete
      document.getElementById('re-tbody').addEventListener('click', e => {
        const btn = e.target.closest('.re-del-btn');
        if (!btn) return;
        draft.splice(parseInt(btn.dataset.i), 1);
        render();
      });

      // Add player
      document.getElementById('re-add').onclick = () => {
        draft.push({ player:'', pos:'WR', rookieDeal:'N', val2025:'0', val2026:'TBD' });
        render();
        const inputs = document.querySelectorAll('.re-name');
        if (inputs.length) inputs[inputs.length - 1].focus();
      };

      // Cancel
      document.getElementById('re-cancel').onclick = () => window.showTeamDetail(team);

      // Save
      document.getElementById('re-save').onclick = async () => {
        const saveBtn = document.getElementById('re-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';

        const rows = document.querySelectorAll('#re-tbody tr');
        const updated = [];
        rows.forEach(row => {
          const name = row.querySelector('.re-name').value.trim();
          if (!name) return;
          updated.push({
            player:     name,
            pos:        row.querySelector('.re-pos').value,
            rookieDeal: row.querySelector('.re-contract').value.trim(),
            val2025:    row.querySelector('.re-val25').value.trim(),
            val2026:    row.querySelector('.re-val26').value.trim(),
          });
        });

        LEAGUE_DATA.rosters[team] = updated;

        // Sync keepers2026 from updated roster (only if keepers not locked for this team)
        if (!(LEAGUE_DATA.keeperLocks && LEAGUE_DATA.keeperLocks[team])) {
          LEAGUE_DATA.keepers2026[team] = updated
            .filter(p => { const v = parseInt(p.val2026); return !isNaN(v) && v > 0; })
            .map(p => ({ player: p.player, value: p.val2026 }));
        }

        // Sync budget stats
        if (LEAGUE_DATA.budgets && LEAGUE_DATA.budgets[team]) {
          const b = LEAGUE_DATA.budgets[team];
          const { dispKept, dispCnt, remaining } = calcSummary();
          b.totalKept     = String(dispKept);
          b.playerCount   = String(dispCnt);
          b.remaining     = String(remaining);
          b.inSeasonFaab  = String(remaining + 25);
        }

        // Push to Firebase immediately via REST (no SDK dependency).
        // Full blob first so edits persist without a GitHub token (reader prefers it).
        const _tsR = Date.now();
        window.fbSet && window.fbSet('league_data/leagueData', JSON.stringify(LEAGUE_DATA));
        window.fbSet && window.fbSet('league_data/rosters', LEAGUE_DATA.rosters);
        window.fbSet && window.fbSet('league_data/keepers2026', LEAGUE_DATA.keepers2026);
        window.fbSet && window.fbSet('league_data/budgets', LEAGUE_DATA.budgets);
        window.fbSet && window.fbSet('league_data/_version', _tsR);
        const ok = await window.commSave.saveData(
          'LEAGUE_DATA', LEAGUE_DATA,
          `Commissioner: update ${team} roster`
        );
        if (ok) {
          setTimeout(() => window.showTeamDetail(team), 600);
        } else {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 Save Roster';
          LEAGUE_DATA.rosters[team] = draft;
        }
      };
    }

    render();
  }

})();

// ===== PHASE 3: TRADE / DRAFT / WRITEUP EDITORS =====
(function() {

  /* ── Helpers ─────────────────────────────────────────────── */
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // Build reverse map: team name → short manager name
  function shortName(teamName) {
    const mgrs = LEAGUE_DATA.managers || {};
    for (const [k,v] of Object.entries(mgrs)) {
      if (v === teamName) return k.charAt(0) + k.slice(1).toLowerCase();
    }
    return teamName;
  }

  // Team dropdown options
  function teamOptions(selected) {
    return (LEAGUE_DATA.teams || []).map(t =>
      `<option value="${esc(t)}" ${t===selected?'selected':''}>${esc(t)}</option>`
    ).join('');
  }

  /* ── Hook nav clicks via event delegation (works with local showPage ref) ── */
  document.addEventListener('DOMContentLoaded', () => {
    const nav = document.getElementById('main-nav');
    if (nav) {
      nav.addEventListener('click', e => {
        const btn = e.target.closest('[data-page]');
        if (!btn) return;
        if (window.commMode && window.commMode.isUnlocked()) {
          setTimeout(() => commPageHook(btn.dataset.page), 50);
        }
      });
    }
    // Trades / Write-ups moved into League History sub-tabs — inject their
    // commissioner edit bars when those sub-tabs are opened (data-section
    // values 'trades' / 'writeups' map directly onto commPageHook).
    const secTabs = document.getElementById('history-section-tabs');
    if (secTabs) {
      secTabs.addEventListener('click', e => {
        const tab = e.target.closest('[data-section]');
        if (!tab) return;
        if (window.commMode && window.commMode.isUnlocked()) {
          setTimeout(() => commPageHook(tab.dataset.section), 50);
        }
      });
    }
  });

  function commPageHook(pageId) {
    if (pageId === 'trades')   injectTradesEditBar();
    if (pageId === 'draft')    injectDraftEditBar();
    if (pageId === 'writeups') injectWriteupsEditBar();
  }

  /* ══════════════════════════════════════════════════════════
     TRADES EDITOR
  ══════════════════════════════════════════════════════════ */
  function injectTradesEditBar() {
    const page = document.getElementById('history-section-trades');
    if (!page || page.querySelector('.comm-page-editbar')) return;
    const bar = document.createElement('div');
    bar.className = 'comm-page-editbar';
    const years = Object.keys(LEAGUE_DATA.trades).sort((a,b)=>b-a);
    bar.innerHTML = `
      <span class="comm-page-editlabel">⚡ Edit Trades</span>
      <select class="comm-year-sel" id="te-year">
        ${years.map(y=>`<option value="${y}">${y}</option>`).join('')}
        <option value="__new__">＋ New Year…</option>
      </select>
      <button class="comm-btn-add" id="te-add">＋ Add Entry</button>
      <button class="comm-btn-save" id="te-save">💾 Save</button>
    `;
    const title = page.querySelector('.section-title');
    title ? title.after(bar) : page.insertBefore(bar, page.firstChild);

    document.getElementById('te-year').addEventListener('change', function() {
      if (this.value === '__new__') {
        const yr = prompt('Enter year (e.g. 2026):');
        if (!yr) { this.value = years[0]; return; }
        if (!LEAGUE_DATA.trades[yr]) LEAGUE_DATA.trades[yr] = [];
        const opt = document.createElement('option');
        opt.value = yr; opt.textContent = yr;
        this.insertBefore(opt, this.querySelector('[value="__new__"]'));
        this.value = yr;
      }
      renderTradesEdit(this.value);
    });
    document.getElementById('te-add').addEventListener('click', () => {
      const yr = document.getElementById('te-year').value;
      if (!LEAGUE_DATA.trades[yr]) LEAGUE_DATA.trades[yr] = [];
      LEAGUE_DATA.trades[yr].unshift({ manager:'', managerOriginal:'', received:'' });
      renderTradesEdit(yr);
      document.querySelector('.te-manager-sel')?.focus();
    });
    document.getElementById('te-save').addEventListener('click', saveTrades);

    renderTradesEdit(years[0]);
  }

  function renderTradesEdit(year) {
    const contentEl = document.getElementById('trades-content');
    const tabsEl    = document.getElementById('trades-year-tabs');
    // Hide built-in tabs while in edit mode
    if (tabsEl) tabsEl.style.display = 'none';

    const trades = LEAGUE_DATA.trades[year] || [];
    if (!trades.length) {
      contentEl.innerHTML = '<div class="te-empty">No trades for this year. Click ＋ Add Entry.</div>';
      return;
    }
    contentEl.innerHTML = `
      <table class="te-table">
        <thead><tr><th style="width:30%">Team</th><th>Received</th><th style="width:5%"></th></tr></thead>
        <tbody>
          ${trades.map((t,i) => `
            <tr data-ti="${i}">
              <td><select class="re-input te-manager-sel" data-i="${i}">
                <option value="">— select team —</option>
                ${teamOptions(t.manager)}
              </select></td>
              <td><input class="re-input te-received" data-i="${i}" value="${esc(t.received)}" placeholder="What they received…" /></td>
              <td><button class="re-del-btn te-del" data-i="${i}">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    // Sync manager → managerOriginal on change
    contentEl.querySelectorAll('.te-manager-sel').forEach(sel => {
      sel.addEventListener('change', function() {
        const i = parseInt(this.dataset.i);
        trades[i].manager = this.value;
        trades[i].managerOriginal = shortName(this.value);
      });
    });
    contentEl.querySelectorAll('.te-received').forEach(inp => {
      inp.addEventListener('input', function() {
        trades[parseInt(this.dataset.i)].received = this.value;
      });
    });
    contentEl.querySelectorAll('.te-del').forEach(btn => {
      btn.addEventListener('click', function() {
        trades.splice(parseInt(this.dataset.i), 1);
        LEAGUE_DATA.trades[year] = trades;
        renderTradesEdit(year);
      });
    });
  }

  async function saveTrades() {
    const btn = document.getElementById('te-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    // Flush current field values into data before save
    const yr = document.getElementById('te-year').value;
    document.querySelectorAll('.te-manager-sel').forEach(sel => {
      const i = parseInt(sel.dataset.i);
      if (LEAGUE_DATA.trades[yr] && LEAGUE_DATA.trades[yr][i]) {
        LEAGUE_DATA.trades[yr][i].manager = sel.value;
        LEAGUE_DATA.trades[yr][i].managerOriginal = shortName(sel.value);
      }
    });
    document.querySelectorAll('.te-received').forEach(inp => {
      const i = parseInt(inp.dataset.i);
      if (LEAGUE_DATA.trades[yr] && LEAGUE_DATA.trades[yr][i]) {
        LEAGUE_DATA.trades[yr][i].received = inp.value.trim();
      }
    });
    // Remove blank entries
    LEAGUE_DATA.trades[yr] = (LEAGUE_DATA.trades[yr] || []).filter(t => t.received.trim() || t.manager);

    // Push to Firebase immediately via REST (no SDK dependency)
    const _tsT = Date.now();
    window.fbSet && window.fbSet('league_data/leagueData', JSON.stringify(LEAGUE_DATA));
    window.fbSet && window.fbSet('league_data/trades', LEAGUE_DATA.trades);
    window.fbSet && window.fbSet('league_data/_version', _tsT);
    const ok = await window.commSave.saveData('LEAGUE_DATA', LEAGUE_DATA, `Commissioner: update ${yr} trades`);
    btn.disabled = false; btn.textContent = '💾 Save';
    if (ok) { renderTradesEdit(yr); window.buildTrades && window.buildTrades(); }
  }

  /* ══════════════════════════════════════════════════════════
     DRAFT EDITOR
  ══════════════════════════════════════════════════════════ */
  // 2026 NFL Draft fantasy-relevant rookie class (name + position).
  // Pulled from post-draft dynasty rankings; editable — add/remove names as needed.
  const ROOKIE_POOL_2026 = [
    {n:"Fernando Mendoza",p:"QB"}, {n:"Ty Simpson",p:"QB"}, {n:"Carson Beck",p:"QB"},
    {n:"Jeremiyah Love",p:"RB"}, {n:"Jadarian Price",p:"RB"}, {n:"Jonah Coleman",p:"RB"},
    {n:"Kaelon Black",p:"RB"}, {n:"Makhi Hughes",p:"RB"}, {n:"Nick Singleton",p:"RB"},
    {n:"Kaytron Allen",p:"RB"}, {n:"Jayden Ott",p:"RB"},
    {n:"Mike Washington Jr.",p:"RB"}, {n:"Emmett Johnson",p:"RB"}, {n:"Adam Randall",p:"RB"},
    {n:"Demond Claiborne",p:"RB"}, {n:"Seth McGowan",p:"RB"}, {n:"Eli Heidenreich",p:"RB"},
    {n:"Jamarion Miller",p:"RB"}, {n:"Le'Veon Moss",p:"RB"}, {n:"Noah Whittington",p:"RB"},
    {n:"Desmond Reid",p:"RB"}, {n:"Robert Henry Jr.",p:"RB"}, {n:"Chip Trayanum",p:"RB"},
    {n:"Carnell Tate",p:"WR"}, {n:"Jordyn Tyson",p:"WR"}, {n:"Makai Lemon",p:"WR"},
    {n:"KC Concepcion",p:"WR"}, {n:"Antonio Williams",p:"WR"}, {n:"Omar Cooper Jr.",p:"WR"},
    {n:"Denzel Boston",p:"WR"}, {n:"Zachariah Branch",p:"WR"}, {n:"Chris Bell",p:"WR"},
    {n:"Skyler Bell",p:"WR"}, {n:"De'Zhaun Stribling",p:"WR"}, {n:"Nyck Harbor",p:"WR"},
    {n:"Germie Bernard",p:"WR"}, {n:"Eric Singleton",p:"WR"},
    {n:"Ted Hurst",p:"WR"}, {n:"Chris Brazzell II",p:"WR"}, {n:"Bryce Lance",p:"WR"},
    {n:"Ja'Kobi Lane",p:"WR"}, {n:"Elijah Sarratt",p:"WR"}, {n:"Brenen Thompson",p:"WR"},
    {n:"Malachi Fields",p:"WR"}, {n:"Caleb Douglas",p:"WR"}, {n:"Zavion Thomas",p:"WR"},
    {n:"Kendrick Law",p:"WR"}, {n:"Kevin Coleman Jr.",p:"WR"}, {n:"Malik Benson",p:"WR"},
    {n:"Kenyon Sadiq",p:"TE"}, {n:"Max Klare",p:"TE"}, {n:"Oscar Delp",p:"TE"},
    {n:"Eli Stowers",p:"TE"}, {n:"Justin Joly",p:"TE"}, {n:"Joe Royer",p:"TE"},
  ];
  const _normRk = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  // A pick whose "player" is still an empty placeholder like "Round 1, Pick 1" or "Round 2, Pick 1 (13)".
  const _isPickPlaceholder = s => /^\s*round\s*\d+\s*,\s*pick\s*\d+\s*(\(\s*\d+\s*\))?\s*$/i.test((s||'').trim());

  // Names already chosen across all picks of the given year (to exclude from the dropdown).
  function chosenRookieNames(year) {
    const set = new Set();
    (LEAGUE_DATA.drafts[year] || []).forEach(p => {
      const nm = (p.player || '').trim();
      if (nm && !_isPickPlaceholder(nm)) set.add(_normRk(nm));
    });
    return set;
  }

  // Rebuild the shared rookie datalist with only un-picked rookies.
  function updateRookieDatalist(year) {
    const dl = document.getElementById('de-rookie-list');
    if (!dl) return;
    const taken = chosenRookieNames(year);
    dl.innerHTML = ROOKIE_POOL_2026
      .filter(r => !taken.has(_normRk(r.n)))
      .map(r => `<option value="${esc(r.n)}">${esc(r.n)} — ${esc(r.p)}</option>`)
      .join('');
  }

  // Publish the draft live to all viewers via Firebase (no GitHub commit — that's on Save).
  // Writes the full leagueData blob so picks persist with or without a GitHub token.
  async function publishDraftLive() {
    const rd = LEAGUE_DATA.liveRookieDraft || { active: false };
    // Pick the year to broadcast: the live year if set, else the year being edited,
    // else the newest draft. The node ALWAYS carries that year's picks so viewers
    // update instantly on every Save — the `active` flag only drives the banner.
    let year = rd.year ? String(rd.year) : '';
    if (!year) {
      const sel = document.getElementById('de-year');
      if (sel && sel.value && sel.value !== '__new__') year = String(sel.value);
    }
    if (!year) { const ys = Object.keys(LEAGUE_DATA.drafts).sort((a, b) => b - a); year = ys[0] || ''; }
    // Small, dedicated realtime node — IDENTICAL mechanism to the live auction
    // board (live_draft/picks). The SDK push lands in every browser instantly.
    const node = {
      active: !!rd.active,
      year:   year,
      ts:     Date.now(),
      picks:  (year && Array.isArray(LEAGUE_DATA.drafts[year])) ? LEAGUE_DATA.drafts[year] : []
    };
    if (window._fbDb) {
      try { window._fbDb.ref('live_draft/rookie').set(node); }
      catch(e) { console.warn('rookie live push failed:', e); if (window.fbSet) window.fbSet('live_draft/rookie', node); }
    } else if (window.fbSet) {
      window.fbSet('live_draft/rookie', node);
    }
    // Persist the full blob too so picks survive a reload after the draft ends.
    // CRITICAL ORDERING: await the big (~270KB) blob write BEFORE bumping _version.
    // Otherwise _version can land first, a viewer fetches the still-old blob, and —
    // since _version never bumps again — stays stuck on stale picks while the fast
    // node shows fresh ones. Awaiting guarantees the blob is current when the
    // version pointer that triggers viewers' refetch finally moves.
    if (window.fbSet) {
      await window.fbSet('league_data/leagueData', JSON.stringify(LEAGUE_DATA));
      window.fbSet('league_data/_version', Date.now());
    }
  }
  let _draftPubTimer = null;
  function publishDraftLiveDebounced() {
    clearTimeout(_draftPubTimer);
    _draftPubTimer = setTimeout(publishDraftLive, 700);
  }

  function injectDraftEditBar() {
    const page = document.getElementById('page-draft');
    if (!page || page.querySelector('.comm-page-editbar')) return;
    const bar = document.createElement('div');
    bar.className = 'comm-page-editbar';
    const years = Object.keys(LEAGUE_DATA.drafts).sort((a,b)=>b-a);
    bar.innerHTML = `
      <span class="comm-page-editlabel">⚡ Edit Rookie Draft</span>
      <select class="comm-year-sel" id="de-year">
        ${years.map(y=>`<option value="${y}">${y}</option>`).join('')}
        <option value="__new__">＋ New Year…</option>
      </select>
      <button class="comm-btn-add" id="de-add">＋ Add Pick</button>
      <button class="comm-btn-save" id="de-save">💾 Save</button>
      <button class="comm-btn-add" id="de-live" style="background:#8b0000">🔴 Start Live Draft</button>
    `;
    const title = page.querySelector('.section-title');
    title ? title.after(bar) : page.insertBefore(bar, page.firstChild);

    document.getElementById('de-year').addEventListener('change', function() {
      if (this.value === '__new__') {
        const yr = prompt('Enter year (e.g. 2027):');
        if (!yr) { this.value = years[0]; return; }
        if (!LEAGUE_DATA.drafts[yr]) {
          // Pre-populate 24 empty picks (2 rounds × 12 teams)
          LEAGUE_DATA.drafts[yr] = Array.from({length:24}, (_,i) => ({
            round: `Round ${Math.floor(i/12)+1}`,
            pick: `Pick ${(i%12)+1}`,
            team: '', originalOwner: '', via: '', player: ''
          }));
        }
        const opt = document.createElement('option');
        opt.value = yr; opt.textContent = yr;
        this.insertBefore(opt, this.querySelector('[value="__new__"]'));
        this.value = yr;
      }
      renderDraftEdit(this.value);
    });
    document.getElementById('de-add').addEventListener('click', () => {
      const yr = document.getElementById('de-year').value;
      if (!LEAGUE_DATA.drafts[yr]) LEAGUE_DATA.drafts[yr] = [];
      const n = LEAGUE_DATA.drafts[yr].length;
      LEAGUE_DATA.drafts[yr].push({ round:'', pick:`Pick ${n+1}`, team:'', originalOwner:'', via:'', player:'' });
      renderDraftEdit(yr);
    });
    document.getElementById('de-save').addEventListener('click', saveDraft);

    // ── Live rookie draft toggle ──────────────────────────────────────────────
    // Broadcasts a flag in the live blob; every viewer's Rookie Draft page switches
    // to the live board (on-the-clock + latest pick) and updates in real time as
    // the commissioner types picks. No GitHub commit — live-only state.
    const liveBtn = document.getElementById('de-live');
    function syncLiveBtn() {
      const on = LEAGUE_DATA.liveRookieDraft && LEAGUE_DATA.liveRookieDraft.active;
      liveBtn.textContent = on ? '⏹ End Live Draft' : '🔴 Start Live Draft';
      liveBtn.style.background = on ? '#555' : '#8b0000';
    }
    liveBtn.addEventListener('click', () => {
      const on = LEAGUE_DATA.liveRookieDraft && LEAGUE_DATA.liveRookieDraft.active;
      if (!on) {
        const yr = document.getElementById('de-year').value;
        if (yr === '__new__' || !LEAGUE_DATA.drafts[yr]) { alert('Select a draft year first.'); return; }
        if (!confirm(`Start the LIVE ${yr} rookie draft?\n\nEveryone viewing the Rookie Draft page will see the live board: the team on the clock, the latest pick, and every pick as you enter it.`)) return;
        LEAGUE_DATA.liveRookieDraft = { active: true, year: yr, ts: Date.now() };
      } else {
        if (!confirm('End the live rookie draft?\n\nViewers will see the normal Rookie Draft page again. (This does not delete any picks.)')) return;
        LEAGUE_DATA.liveRookieDraft = { active: false };
      }
      publishDraftLive();
      syncLiveBtn();
    });
    syncLiveBtn();

    renderDraftEdit(years[0]);
  }

  function renderDraftEdit(year) {
    const contentEl = document.getElementById('draft-content');
    const tabsEl    = document.getElementById('draft-year-tabs');
    if (tabsEl) tabsEl.style.display = 'none';

    const picks = LEAGUE_DATA.drafts[year] || [];
    if (!picks.length) {
      contentEl.innerHTML = '<div class="te-empty">No picks for this year.</div>';
      return;
    }
    contentEl.innerHTML = `
      <table class="te-table de-table">
        <thead><tr>
          <th style="width:9%">Round</th>
          <th style="width:9%">Pick</th>
          <th style="width:22%">Team</th>
          <th style="width:16%">Orig Owner</th>
          <th style="width:14%">Via</th>
          <th style="width:22%">Player Selected</th>
          <th style="width:4%"></th>
        </tr></thead>
        <tbody>
          ${picks.map((p,i) => `
            <tr>
              <td><input class="re-input de-round" data-i="${i}" value="${esc(p.round)}" /></td>
              <td><input class="re-input de-pick"  data-i="${i}" value="${esc(p.pick)}"  /></td>
              <td><select class="re-input de-team"  data-i="${i}">
                <option value="">—</option>
                ${teamOptions(p.team)}
              </select></td>
              <td><input class="re-input de-orig"  data-i="${i}" value="${esc(p.originalOwner)}" /></td>
              <td><input class="re-input de-via"   data-i="${i}" value="${esc(p.via)}"   /></td>
              <td><input class="re-input de-player" data-i="${i}" value="${esc(_isPickPlaceholder(p.player) ? '' : (p.player||''))}" placeholder="Pick a rookie…" list="de-rookie-list" autocomplete="off" /></td>
              <td><button class="re-del-btn de-del" data-i="${i}">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      <datalist id="de-rookie-list"></datalist>`;
    updateRookieDatalist(year);

    // Live sync
    ['de-round','de-pick','de-orig','de-via','de-player'].forEach(cls => {
      const field = cls.replace('de-','');
      const key = {round:'round',pick:'pick',orig:'originalOwner',via:'via',player:'player'}[field] || field;
      contentEl.querySelectorAll('.'+cls).forEach(inp => {
        inp.addEventListener('input', function() {
          picks[parseInt(this.dataset.i)][key] = this.value;
        });
      });
    });
    // Rookie picks: refresh the available-rookie list and publish live as each is made.
    // Publish on 'change' (commit/blur) AND debounced on 'input', so picks persist to the
    // database even if the field is never blurred or the Save button isn't clicked.
    contentEl.querySelectorAll('.de-player').forEach(inp => {
      inp.addEventListener('input', function() {
        picks[parseInt(this.dataset.i)].player = this.value;
        publishDraftLiveDebounced();
      });
      inp.addEventListener('change', function() {
        picks[parseInt(this.dataset.i)].player = this.value;
        updateRookieDatalist(year);
        publishDraftLive();
      });
    });
    contentEl.querySelectorAll('.de-team').forEach(sel => {
      sel.addEventListener('change', function() {
        picks[parseInt(this.dataset.i)].team = this.value;
        publishDraftLive();
        // Auto-fill originalOwner if empty
        const orig = contentEl.querySelector(`.de-orig[data-i="${this.dataset.i}"]`);
        if (orig && !orig.value) {
          const sn = shortName(this.value);
          orig.value = sn;
          picks[parseInt(this.dataset.i)].originalOwner = sn;
        }
      });
    });
    contentEl.querySelectorAll('.de-del').forEach(btn => {
      btn.addEventListener('click', function() {
        picks.splice(parseInt(this.dataset.i), 1);
        LEAGUE_DATA.drafts[year] = picks;
        renderDraftEdit(year);
      });
    });
  }

  async function saveDraft() {
    const btn = document.getElementById('de-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    const yr = document.getElementById('de-year').value;
    // Flush values
    const picks = LEAGUE_DATA.drafts[yr] || [];
    document.querySelectorAll('.de-round').forEach(el => { picks[+el.dataset.i] && (picks[+el.dataset.i].round = el.value); });
    document.querySelectorAll('.de-pick').forEach(el => { picks[+el.dataset.i] && (picks[+el.dataset.i].pick = el.value); });
    document.querySelectorAll('.de-team').forEach(el => { picks[+el.dataset.i] && (picks[+el.dataset.i].team = el.value); });
    document.querySelectorAll('.de-orig').forEach(el => { picks[+el.dataset.i] && (picks[+el.dataset.i].originalOwner = el.value); });
    document.querySelectorAll('.de-via').forEach(el => { picks[+el.dataset.i] && (picks[+el.dataset.i].via = el.value); });
    document.querySelectorAll('.de-player').forEach(el => { picks[+el.dataset.i] && (picks[+el.dataset.i].player = el.value); });
    LEAGUE_DATA.drafts[yr] = picks.filter(p => p.player || p.team);

    // Instantly broadcast the live board to every viewer on Save (same dedicated
    // realtime node as the auction) AND persist the blob in the correct order
    // (blob written, THEN _version bumped) so viewers never refetch a stale blob.
    // publishDraftLive is now awaited and owns the league_data writes — the old
    // un-awaited fbSet trio here re-introduced the version-before-blob race.
    await publishDraftLive();
    const ok = await window.commSave.saveData('LEAGUE_DATA', LEAGUE_DATA, `Commissioner: update ${yr} rookie draft`);
    btn.disabled = false; btn.textContent = '💾 Save';
    if (ok) { renderDraftEdit(yr); window.buildDraft && window.buildDraft(); }
  }

  /* ══════════════════════════════════════════════════════════
     WRITEUP EDITOR
  ══════════════════════════════════════════════════════════ */
  function injectWriteupsEditBar() {
    const page = document.getElementById('history-section-writeups');
    if (!page || page.querySelector('.comm-page-editbar')) return;
    const bar = document.createElement('div');
    bar.className = 'comm-page-editbar';
    bar.innerHTML = `
      <span class="comm-page-editlabel">⚡ Edit Write-Ups</span>
      <button class="comm-btn-add" id="wu-add">＋ New Write-Up</button>
      <button class="comm-btn-save" id="wu-save">💾 Save All</button>
    `;
    const title = page.querySelector('.section-title');
    title ? title.after(bar) : page.insertBefore(bar, page.firstChild);

    document.getElementById('wu-add').addEventListener('click', addWriteup);
    document.getElementById('wu-save').addEventListener('click', saveWriteups);

    renderWriteupsEdit();
  }

  let _editingWuIdx = null;

  function renderWriteupsEdit() {
    const tabsEl    = document.getElementById('writeups-year-tabs');
    const contentEl = document.getElementById('writeups-content');
    if (tabsEl) tabsEl.style.display = 'none';

    contentEl.innerHTML = `
      <div class="wu-list">
        ${WRITEUP_SECTIONS.map((s,i) => `
          <div class="wu-row" data-i="${i}">
            <div class="wu-row-header">
              <span class="wu-row-title">${esc(s.title)} <span class="wu-row-year">(${esc(s.year)})</span></span>
              <div class="wu-row-btns">
                <button class="comm-btn-add wu-edit-btn" data-i="${i}">✏️ Edit</button>
                <button class="re-del-btn wu-del-btn" data-i="${i}">✕</button>
              </div>
            </div>
            <div class="wu-editor-area" id="wu-editor-${i}" style="display:none">
              <div class="wu-meta-row">
                <input class="re-input wu-title" data-i="${i}" value="${esc(s.title)}" placeholder="Title" style="flex:2" />
                <input class="re-input wu-year" data-i="${i}" value="${esc(s.year)}" placeholder="Year" style="width:80px" />
              </div>
              <textarea class="wu-textarea" data-i="${i}" rows="14">${esc(s.html)}</textarea>
              <small style="color:var(--text-muted);font-size:11px">HTML supported. Use &lt;p&gt;, &lt;br&gt;, &lt;strong&gt;, etc.</small>
            </div>
          </div>`).join('')}
      </div>`;

    contentEl.querySelectorAll('.wu-edit-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const i = parseInt(this.dataset.i);
        const area = document.getElementById(`wu-editor-${i}`);
        const isOpen = area.style.display !== 'none';
        // Close all
        document.querySelectorAll('.wu-editor-area').forEach(a => a.style.display = 'none');
        document.querySelectorAll('.wu-edit-btn').forEach(b => b.textContent = '✏️ Edit');
        if (!isOpen) {
          area.style.display = 'block';
          this.textContent = '▲ Close';
        }
      });
    });
    contentEl.querySelectorAll('.wu-del-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        if (!confirm('Delete this write-up?')) return;
        WRITEUP_SECTIONS.splice(parseInt(this.dataset.i), 1);
        renderWriteupsEdit();
      });
    });
    // Live sync title/year/html
    contentEl.querySelectorAll('.wu-title').forEach(inp => {
      inp.addEventListener('input', function() { WRITEUP_SECTIONS[+this.dataset.i].title = this.value; });
    });
    contentEl.querySelectorAll('.wu-year').forEach(inp => {
      inp.addEventListener('input', function() { WRITEUP_SECTIONS[+this.dataset.i].year = this.value; });
    });
    contentEl.querySelectorAll('.wu-textarea').forEach(ta => {
      ta.addEventListener('input', function() { WRITEUP_SECTIONS[+this.dataset.i].html = this.value; });
    });
  }

  function addWriteup() {
    WRITEUP_SECTIONS.unshift({ title: 'New Write-Up', year: new Date().getFullYear().toString(), html: '<p>Write your content here.</p>' });
    renderWriteupsEdit();
    document.querySelector('.wu-edit-btn')?.click(); // Auto-open first editor
  }

  async function saveWriteups() {
    const btn = document.getElementById('wu-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    // Flush textarea values
    document.querySelectorAll('.wu-textarea').forEach(ta => {
      WRITEUP_SECTIONS[+ta.dataset.i].html = ta.value;
    });
    document.querySelectorAll('.wu-title').forEach(inp => {
      WRITEUP_SECTIONS[+inp.dataset.i].title = inp.value;
    });
    document.querySelectorAll('.wu-year').forEach(inp => {
      WRITEUP_SECTIONS[+inp.dataset.i].year = inp.value;
    });
    const ok = await window.commSave.saveData('WRITEUP_SECTIONS', WRITEUP_SECTIONS, 'Commissioner: update write-ups');
    btn.disabled = false; btn.textContent = '💾 Save All';
    if (ok) { renderWriteupsEdit(); window.buildWriteUps && window.buildWriteUps(); }
  }

  /* ── Expose buildTrades/buildDraft so save handlers can refresh view ── */
  // They're already in scope at module level – alias them globally
  window._commRefreshTrades  = () => { if (typeof buildTrades  === 'function') buildTrades(); };
  window._commRefreshDraft   = () => { if (typeof buildDraft   === 'function') buildDraft(); };
  window._commRefreshWriteUps= () => { if (typeof buildWriteUps=== 'function') buildWriteUps(); };

})();
// ===== END PHASE 3 =====


// ===== PHASE 4: LIVE DRAFT TOOL =====
(function() {
  /* ── Firebase config ──────────────────────────────────────────────────────
     Fill in your Firebase project details below.
     Create a free project at console.firebase.google.com and enable
     Realtime Database with public read rules for the /live_draft path.
  ── */
  const FB_CONFIG = {
  apiKey: "AIzaSyATTiAKw1ZMa-Crrq4OmN9Y2tAOsEuXs0g",
  authDomain: "msuffl.firebaseapp.com",
  databaseURL: "https://msuffl-default-rtdb.firebaseio.com",
  projectId: "msuffl",
  storageBucket: "msuffl.firebasestorage.app",
  messagingSenderId: "999714364030",
  appId: "1:999714364030:web:424a938199ba1244edd62f",
  measurementId: "G-4K7G8BVEB0"
};
  const FB_CONFIGURED = !FB_CONFIG.apiKey.startsWith('REPLACE');
  const FB_DB_URL = FB_CONFIG.databaseURL;

  // Returns the signed-in commissioner's Firebase Auth ID token, or null.
  window.fbAuthToken = async function fbAuthToken() {
    try {
      if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        return await firebase.auth().currentUser.getIdToken();
      }
    } catch(e) { /* not signed in */ }
    return null;
  };

  // REST-based AUTHENTICATED write — exposed globally so Phase 3 / roster editor can call it.
  // Database rules require auth for league_data / live_draft / backups, so this attaches
  // the commissioner's ID token. Writes fail loudly (toast in console) if not signed in.
  // Returns true only on a confirmed successful write — callers that need to know
  // whether a write actually landed (e.g. resetDatabase) must check this instead of
  // assuming success, since this function used to resolve silently on every failure
  // path (file://, no auth, network error, HTTP error), making failures invisible.
  window.fbSet = async function fbSet(path, data) {
    if (!FB_CONFIGURED || !FB_DB_URL) return false;
    if (location.protocol === 'file:') {
      console.warn('Firebase writes do not work from file:// — use the deployed site or a local web server.');
      return false;
    }
    try {
      const tok = await window.fbAuthToken();
      const q = tok ? `?auth=${encodeURIComponent(tok)}` : '';
      const r = await fetch(`${FB_DB_URL}/${path}.json${q}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (r.status === 401 || r.status === 403) {
        console.warn(`Firebase write DENIED (${r.status}): ${path} — commissioner is not signed in to Firebase Auth. Log out and back in.`);
        if (window.commSave && window.commSave.showToast) {
          window.commSave.showToast('⚠ LIVE WRITE DENIED — this change will NOT survive a reload', 'error');
        }
        if (!window.__fbDenyAlerted) {
          window.__fbDenyAlerted = true;
          alert('⚠️ The live database REJECTED a commissioner write.\n\nYour edits show on screen but will NOT survive a reload.\n\nCause: you are not signed in to Firebase' + (tok ? ' with a valid account' : '') + '.\n\nFix:\n1. Firebase console → Authentication → Sign-in method: enable Email/Password.\n2. Authentication → Users: add commissioner@msuffl.com with your commissioner password (or reset its password to match).\n3. On the site: click the 🔓 lock to log out, then log back in.');
        }
        return false;
      } else if (!r.ok) { console.warn(`Firebase write failed (${r.status}):`, path); return false; }
      console.log(`Firebase write OK:`, path);
      return true;
    } catch(e) { console.warn('Firebase REST write failed:', e); return false; }
  }

  // PUBLIC (unauthenticated) write — only for paths the database rules deliberately
  // leave open: keeper_submissions/<team> (create-only) and league_data/_version.
  // Returns { ok, reason }: reason is 'denied' (rules rejected it), 'network',
  // 'file-protocol' (opened as a local file), or 'not-configured'.
  window.fbPublicSet = async function fbPublicSet(path, data) {
    if (!FB_CONFIGURED || !FB_DB_URL) return { ok: false, reason: 'not-configured' };
    if (location.protocol === 'file:') {
      console.warn('Firebase writes do not work from file:// — use the deployed site or a local web server.');
      return { ok: false, reason: 'file-protocol' };
    }
    try {
      const r = await fetch(`${FB_DB_URL}/${path}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!r.ok) console.warn(`Firebase public write failed (${r.status}):`, path);
      return { ok: r.ok, reason: r.ok ? '' : ((r.status === 401 || r.status === 403) ? 'denied' : 'network') };
    } catch(e) { console.warn('Firebase public write failed:', e); return { ok: false, reason: 'network' }; }
  }

  // Snapshot the full league blob to backups/<timestamp> (authed) and prune to the
  // newest 10 so a bad save can always be rolled back from the Firebase console.
  window.fbSnapshot = async function fbSnapshot(data, note) {
    if (!FB_CONFIGURED || !FB_DB_URL) return;
    try {
      const tok = await window.fbAuthToken();
      if (!tok) return; // snapshots are commissioner-only
      const q = `?auth=${encodeURIComponent(tok)}`;
      const ts = Date.now();
      await fetch(`${FB_DB_URL}/backups/${ts}.json${q}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || '', data: JSON.stringify(data) })
      });
      // Prune: shallow-list keys, delete all but the newest 10
      const list = await fetch(`${FB_DB_URL}/backups.json${q}&shallow=true`);
      if (list.ok) {
        const keys = Object.keys((await list.json()) || {}).sort((a,b) => Number(a) - Number(b));
        for (const k of keys.slice(0, Math.max(0, keys.length - 10))) {
          await fetch(`${FB_DB_URL}/backups/${k}.json${q}`, { method: 'DELETE' });
        }
      }
    } catch(e) { console.warn('Firebase snapshot failed:', e); }
  }

  // Firebase keys can't contain . # $ [ ] /
  window.fbTeamKey = function fbTeamKey(team) {
    return String(team).replace(/[.#$\[\]\/]/g, '_');
  };

  // Merge manager keeper submissions (public per-team node) into LEAGUE_DATA.
  // Managers write only to keeper_submissions/<team>; the main blob stays
  // commissioner-only. A submission applies unless the blob already locks that team.
  window.mergeKeeperSubmissions = async function mergeKeeperSubmissions() {
    if (!FB_CONFIGURED || !FB_DB_URL) return;
    try {
      const r = await fetch(`${FB_DB_URL}/keeper_submissions.json?t=${Date.now()}`);
      if (!r.ok) return;
      const subs = await r.json();
      if (!subs) return;
      LEAGUE_DATA.keepers2026 = LEAGUE_DATA.keepers2026 || {};
      LEAGUE_DATA.keeperLocks = LEAGUE_DATA.keeperLocks || {};
      LEAGUE_DATA.budgets     = LEAGUE_DATA.budgets || {};
      const keyToTeam = {};
      (LEAGUE_DATA.teams || []).forEach(t => { keyToTeam[window.fbTeamKey(t)] = t; });
      for (const [key, sub] of Object.entries(subs)) {
        const team = keyToTeam[key] || key;
        if (!sub || !sub.locked || !Array.isArray(sub.picks)) continue;
        if (LEAGUE_DATA.keeperLocks[team]) continue; // blob already has a (possibly newer) commissioner-saved state
        LEAGUE_DATA.keepers2026[team] = sub.picks;
        LEAGUE_DATA.keeperLocks[team] = true;
        if (sub.budget) LEAGUE_DATA.budgets[team] = sub.budget;
      }
    } catch(e) { /* offline — ignore */ }
  };

  /* ── Add "Live Draft" nav button and page ───────────────────────────────── */
  function setupLiveDraftUI() {
    // Only add once
    if (document.getElementById('page-livedraft')) return;

    // Nav button
    const nav = document.querySelector('.nav-bar') || document.querySelector('nav');
    if (nav) {
      const btn = document.createElement('button');
      btn.className = 'nav-btn';
      btn.dataset.page = 'livedraft';
      btn.textContent = '🎯 Live Draft';
      // Place Live Draft between "2026 Keepers" and "Trade Analyzer"
      const taBtn = nav.querySelector('.nav-btn[data-page="tradeanalyzer"]');
      if (taBtn) nav.insertBefore(btn, taBtn); else nav.appendChild(btn);
      btn.addEventListener('click', () => {
        // Static NodeLists don't include dynamic elements, so handle show/hide manually
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const ldPage = document.getElementById('page-livedraft');
        if (ldPage) ldPage.classList.add('active');
        btn.classList.add('active');
        history.replaceState(null, '', location.pathname + '#livedraft');
        // Show comm controls if unlocked
        if (window.commMode && window.commMode.isUnlocked()) {
          const ctrl = document.getElementById('ld-comm-controls');
          if (ctrl) ctrl.style.display = '';
          if (!document.getElementById('ld-submit-pick')._wired) wireDraftControls();
        }
      });
    }

    // Page container
    // Insert next to existing pages (no wrapper div — pages are direct children of body area)
    const anyExistingPage = document.querySelector('.page');
    const pagesParent = anyExistingPage ? anyExistingPage.parentNode : document.body;
    {
      const page = document.createElement('div');
      page.className = 'page';
      page.id = 'page-livedraft';
      page.innerHTML = `
        <div class="section-title">🎯 Live Draft Board</div>
        <div id="livedraft-inner">
          ${!FB_CONFIGURED ? `
            <div class="ld-setup-notice">
              <strong>Firebase not configured.</strong><br>
              To enable the live draft board, the commissioner needs to:<br>
              1. Create a free Firebase project at <a href="https://console.firebase.google.com" target="_blank">console.firebase.google.com</a><br>
              2. Enable Realtime Database<br>
              3. Set database rules to allow public read on <code>/live_draft</code><br>
              4. Fill in the <code>FB_CONFIG</code> block in the site source (commissioner mode → Edit Write-Ups is not the place — edit the source directly)<br>
              <br>
              Once configured, this board shows all picks in real time for every manager.
            </div>` : `
            <div id="ld-status-bar" class="ld-status-bar"></div>
            <div id="ld-nom-strip" class="ld-nom-strip" style="display:none"></div>
            <div id="ld-comm-controls" class="ld-comm-controls" style="display:none">
              <div class="comm-page-editbar" style="margin-bottom:12px">
                <span class="comm-page-editlabel">⚡ Draft Controls</span>
                <select id="ld-pick-team" class="comm-year-sel" style="min-width:180px">
                  <option value="">— Select team on the clock —</option>
                  ${(LEAGUE_DATA.teams||[]).map(t=>`<option value="${t}">${t}</option>`).join('')}
                </select>
                <input id="ld-pick-player" class="re-input" placeholder="Player name" style="width:200px" list="ld-players-list" autocomplete="off" />
                <datalist id="ld-players-list"></datalist>
                <select id="ld-pick-pos" class="comm-year-sel">
                  <option>QB</option><option>RB</option><option>WR</option>
                  <option>TE</option><option>K</option><option>D/ST</option>
                </select>
                <input id="ld-pick-bid" class="re-input" placeholder="Auction $" type="number" min="1" style="width:80px" />
                <button class="comm-btn-save" id="ld-submit-pick">✅ Submit Pick</button>
                <button class="comm-btn-add" id="ld-finalize-draft" style="background:#1a6b3a">📋 Finalize Draft</button>
                <button class="comm-btn-add" id="ld-reset-draft" style="background:#8b0000">🗑 Reset Draft</button>
              </div>
            </div>
            <div class="ld-layout">
              <div class="ld-team-panel" id="ld-panel-left">
                <div class="ld-tc-panel-label">Teams</div>
              </div>
              <div class="ld-center">
                <div id="ld-pool-status" class="ld-pool-status"></div>
                <div id="ld-board" class="ld-board"></div>
              </div>
              <div class="ld-team-panel" id="ld-panel-right">
                <div class="ld-tc-panel-label">Teams</div>
              </div>
            </div>
            <div id="ld-top-available" class="ld-top-available"></div>
            <div class="ld-pos-modal-overlay" id="ld-pos-modal-overlay">
              <div class="ld-pos-modal">
                <button class="ld-pos-modal-close" id="ld-pos-modal-close">✕</button>
                <h3 id="ld-pos-modal-title">Position</h3>
                <div class="ld-pos-modal-list" id="ld-pos-modal-list"></div>
              </div>
            </div>
          `}
        </div>`;
      pagesParent.appendChild(page);
    }

    // Wire the "click a position to see the full list" modal once. The mini
    // per-position cards inside #ld-top-available are also independently
    // scrollable (see renderTopAvailable) so this modal is for a bigger, easier
    // to read view — not the only way to see players past the first few.
    const topAvailEl = document.getElementById('ld-top-available');
    if (topAvailEl && !topAvailEl._posModalWired) {
      topAvailEl._posModalWired = true;
      topAvailEl.addEventListener('click', e => {
        const hdr = e.target.closest('.ld-top-pos-hdr');
        if (hdr && hdr.dataset.pos) openPosModal(hdr.dataset.pos);
      });
      topAvailEl.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const hdr = e.target.closest('.ld-top-pos-hdr');
        if (hdr && hdr.dataset.pos) { e.preventDefault(); openPosModal(hdr.dataset.pos); }
      });
    }
    const posModalOverlay = document.getElementById('ld-pos-modal-overlay');
    if (posModalOverlay && !posModalOverlay._wired) {
      posModalOverlay._wired = true;
      posModalOverlay.addEventListener('click', e => { if (e.target === posModalOverlay) closePosModal(); });
      const closeBtn = document.getElementById('ld-pos-modal-close');
      if (closeBtn) closeBtn.addEventListener('click', closePosModal);
      document.addEventListener('keydown', e => { if (e.key === 'Escape') closePosModal(); });
    }

    if (FB_CONFIGURED) {
      loadFirebase();
    }
  }

  /* ── Firebase loader ─────────────────────────────────────────────────────── */
  function loadFirebase() {
    if (window._fbLoaded) { initLiveDraft(); return; }
    const sdkScript = document.createElement('script');
    sdkScript.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
    sdkScript.onload = () => {
      const authScript = document.createElement('script');
      authScript.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js';
      authScript.onload = () => {
        const dbScript = document.createElement('script');
        dbScript.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js';
        dbScript.onload = () => { window._fbLoaded = true; initLiveDraft(); };
        document.head.appendChild(dbScript);
      };
      document.head.appendChild(authScript);
    };
    document.head.appendChild(sdkScript);
  }

  function initLiveDraft() {
    if (window._fbApp) return;
    try {
      window._fbApp = firebase.initializeApp(FB_CONFIG);
      window._fbDb  = firebase.database();
    } catch(e) {
      console.error('Firebase init failed:', e);
      document.getElementById('ld-status-bar').textContent = '⚠ Firebase connection failed: ' + e.message;
      return;
    }
    // Snapshot pre-draft rosters/budgets so edits/deletes can rebuild cleanly
    if (!window._ldBaseRosters) {
      window._ldBaseRosters = JSON.parse(JSON.stringify(LEAGUE_DATA.rosters || {}));
      window._ldBaseBudgets  = JSON.parse(JSON.stringify(LEAGUE_DATA.budgets  || {}));
    }
    subscribeToPicksFeed();
    fetchPlayerPool();

    // ── Realtime league_data push (rookie draft, rosters, keepers, trades) ────
    // The auction board gets instant updates via the SDK listener on
    // live_draft/picks. Everything else (notably the rookie draft) flows through
    // league_data/_version. Listen to it with the same SDK connection so every
    // viewer's page refreshes instantly — not just within the 10s poll window.
    if (!window._ldVersionListener) {
      try {
        window._fbDb.ref('league_data/_version').on('value', () => {
          if (window.__applyLatestData) window.__applyLatestData();
        });
        window._ldVersionListener = true;
      } catch(e) { /* fall back to REST polling in initDataSync */ }
    }

    // ── Instant rookie-draft board (twin of the auction's live_draft/picks) ───
    // Every viewer subscribes to the small live_draft/rookie node; the SDK fires
    // immediately on load with the current value AND on every subsequent change,
    // so picks the commissioner enters appear in every browser within a moment.
    if (!window._rookieLiveListener) {
      try {
        window._fbDb.ref('live_draft/rookie').on('value', snap => {
          window.__rookieLive = snap.val() || null;
          if (window.__applyRookieLive) window.__applyRookieLive();
        });
        window._rookieLiveListener = true;
      } catch(e) { /* fall back to REST polling in initDataSync */ }
    }

    if (window.commMode && window.commMode.isUnlocked()) {
      const ctrl = document.getElementById('ld-comm-controls');
      if (ctrl) ctrl.style.display = '';
      wireDraftControls();
    }
  }

  /* ── Real-time data sync via Firebase SSE + polling fallback ────────────── */
  function initDataSync() {
    if (!FB_CONFIGURED || !FB_DB_URL) return;

    let _lastFbVersion = 0;

    // Re-renders whichever page is currently visible
    function refreshCurrentPage() {
      const page = (document.querySelector('.nav-btn.active') || {}).dataset?.page;
      if (page === 'rosters'   && typeof buildRosters === 'function') buildRosters();
      if (page === 'history'   && typeof buildTrades  === 'function' && !document.querySelector('#history-section-trades .comm-page-editbar')) buildTrades();
      // The draft is rebuilt ALWAYS (not just when it's the focused tab): pages are
      // only toggled on nav, never re-rendered, so without this a synced pick stays
      // hidden until the viewer clicks a year tab. This is the safety net for when
      // the SDK websocket channel is unavailable (e.g. mobile private browsing).
      if (typeof buildDraft === 'function' && !document.querySelector('#page-draft .comm-page-editbar')) buildDraft();
      if (page === 'keepers'   && typeof buildKeepers === 'function') buildKeepers();
      if (page === 'keepers'   && typeof window.kpRender === 'function') window.kpRender();
      // Keep the Live Draft board's base rosters in sync with freshly-pulled data
      // so a viewer's board reflects e.g. the commissioner releasing non-keepers
      // without needing a hard reload. Only when the board has been initialized;
      // refreshLiveDraftBase itself guards against re-snapshotting mid-auction.
      if (window._ldBaseRosters && typeof window.refreshLiveDraftBase === 'function') {
        try { window.refreshLiveDraftBase(); } catch(e){}
      }
    }

    async function applyLatestData(force) {
      try {
        // Lightweight check: fetch only _version (tiny payload, runs every 10s).
        // When `force` is set (initial load), skip the gate entirely so a refresh
        // ALWAYS pulls the current blob — otherwise, if _version hasn't moved since
        // this browser last saw it (or is null), we'd bail out here and keep showing
        // the stale embedded leagueData.js until a pick bumps the version.
        const vRes = await fetch(`${FB_DB_URL}/league_data/_version.json?t=${Date.now()}`);
        const version = vRes.ok ? await vRes.json() : 0;
        if (!force && (!version || version <= _lastFbVersion)) return;
        if (version) { _lastFbVersion = version; window.__fbVersionSeen = version; }

        // On a forced initial sync, also pull the live rookie node directly via REST
        // so the board (and LIVE banner) is correct even if the Firebase SDK hasn't
        // loaded yet or is blocked (e.g. mobile private browsing).
        if (force) {
          try {
            const nRes = await fetch(`${FB_DB_URL}/live_draft/rookie.json?t=${Date.now()}`);
            if (nRes.ok) { const n = await nRes.json(); if (n) window.__rookieLive = n; }
          } catch(e) {}
        }

        // Only skip syncing when a commissioner PAGE editor is actually open
        // (trades / rookie draft / write-ups), to avoid clobbering unsaved edits.
        // Must be scoped to those page containers — the auction page's static
        // `.comm-page-editbar` is always in the DOM and a bare selector here froze
        // ALL data sync for every viewer.
        if (document.querySelector('#page-draft .comm-page-editbar, #history-section-trades .comm-page-editbar, #history-section-writeups .comm-page-editbar')) return;

        // Version changed — fetch full league data (stored as JSON string to preserve arrays)
        const dRes = await fetch(`${FB_DB_URL}/league_data/leagueData.json?t=${Date.now()}`);
        if (dRes.ok) {
          const raw = await dRes.json();
          if (raw) {
            const fresh = typeof raw === 'string' ? JSON.parse(raw) : raw;
            Object.assign(LEAGUE_DATA, fresh);
            // The instant rookie node wins over the slower blob so the two
            // channels never disagree (blob can lag the live picks by a moment).
            // Applies whenever the node carries picks — the active flag only drives
            // the banner, not which picks are shown.
            const rl = window.__rookieLive;
            if (rl && rl.year && Array.isArray(rl.picks) && rl.picks.length) {
              LEAGUE_DATA.drafts[String(rl.year)] = rl.picks;
              if (rl.active) LEAGUE_DATA.liveRookieDraft = { active: true, year: String(rl.year), ts: rl.ts || Date.now() };
            }
            await window.mergeKeeperSubmissions();
            refreshCurrentPage();
            return;
          }
        }

        // Fallback: partial field-by-field update (pre-leagueData or if leagueData missing)
        const fRes = await fetch(`${FB_DB_URL}/league_data.json?t=${Date.now()}`);
        if (!fRes.ok) return;
        const data = await fRes.json();
        if (data.trades)  { LEAGUE_DATA.trades  = data.trades;
          if (document.querySelector('#history-section-trades.active') && typeof buildTrades === 'function') buildTrades(); }
        if (data.drafts)  { LEAGUE_DATA.drafts  = data.drafts;
          if (document.querySelector('.nav-btn[data-page="draft"].active') && typeof buildDraft === 'function') buildDraft(); }
        if (data.budgets) { LEAGUE_DATA.budgets = data.budgets; }
        if (data.rosters) { LEAGUE_DATA.rosters = data.rosters;
          if (typeof buildRosters === 'function') buildRosters(); }
        await window.mergeKeeperSubmissions();
      } catch(e) { /* ignore */ }
    }

    // ── SSE: Firebase pushes _version changes instantly to all browsers ──────
    try {
      const sse = new EventSource(`${FB_DB_URL}/league_data/_version.json`, {
        headers: { Accept: 'text/event-stream' }
      });
      sse.addEventListener('put', () => applyLatestData());
      sse.addEventListener('patch', () => applyLatestData());
      sse.onerror = () => {}; // silence disconnect noise
    } catch(e) {}

    // ── Polling fallback: catches up if SSE misses anything ──────────────────
    applyLatestData(true);                       // forced: always render current data on load
    setInterval(() => applyLatestData(), 10000); // every 10s as safety net (gated)

    // Expose so the Firebase SDK realtime listener (set up once the SDK loads in
    // initLiveDraft) can push instant updates for ALL league_data changes —
    // rookie draft, rosters, keepers, trades — the same way the auction board
    // gets instant picks. This makes the rookie draft live-update across every
    // browser, not just the commissioner's tab.
    window.__applyLatestData = applyLatestData;
  }

  /* ── Subscribe to real-time picks feed ───────────────────────────────────── */
  let _allPicks = [];
  let _ldPlayerPool = [];
  function fetchPlayerPool() {
    _ldPlayerPool = [{"name":"Bijan Robinson","pos":"RB","nflTeam":"ATL","rank":1},
    {"name":"Ja'Marr Chase","pos":"WR","nflTeam":"CIN","rank":2},
    {"name":"Jahmyr Gibbs","pos":"RB","nflTeam":"DET","rank":3},
    {"name":"Puka Nacua","pos":"WR","nflTeam":"LAR","rank":4},
    {"name":"Jaxon Smith-Njigba","pos":"WR","nflTeam":"SEA","rank":5},
    {"name":"Christian McCaffrey","pos":"RB","nflTeam":"SF","rank":6},
    {"name":"Amon-Ra St. Brown","pos":"WR","nflTeam":"DET","rank":7},
    {"name":"CeeDee Lamb","pos":"WR","nflTeam":"DAL","rank":8},
    {"name":"Jonathan Taylor","pos":"RB","nflTeam":"IND","rank":9},
    {"name":"Justin Jefferson","pos":"WR","nflTeam":"MIN","rank":10},
    {"name":"James Cook III","pos":"RB","nflTeam":"BUF","rank":11},
    {"name":"Drake London","pos":"WR","nflTeam":"ATL","rank":12},
    {"name":"De'Von Achane","pos":"RB","nflTeam":"MIA","rank":13},
    {"name":"Ashton Jeanty","pos":"RB","nflTeam":"LV","rank":14},
    {"name":"Nico Collins","pos":"WR","nflTeam":"HOU","rank":15},
    {"name":"Rashee Rice","pos":"WR","nflTeam":"KC","rank":16},
    {"name":"Trey McBride","pos":"TE","nflTeam":"ARI","rank":17},
    {"name":"Malik Nabers","pos":"WR","nflTeam":"NYG","rank":18},
    {"name":"Saquon Barkley","pos":"RB","nflTeam":"PHI","rank":19},
    {"name":"Chase Brown","pos":"RB","nflTeam":"CIN","rank":20},
    {"name":"Brock Bowers","pos":"TE","nflTeam":"LV","rank":21},
    {"name":"Omarion Hampton","pos":"RB","nflTeam":"LAC","rank":22},
    {"name":"George Pickens","pos":"WR","nflTeam":"DAL","rank":23},
    {"name":"Kenneth Walker III","pos":"RB","nflTeam":"KC","rank":24},
    {"name":"Chris Olave","pos":"WR","nflTeam":"NO","rank":25},
    {"name":"Josh Allen","pos":"QB","nflTeam":"BUF","rank":26},
    {"name":"A.J. Brown","pos":"WR","nflTeam":"PHI","rank":27},
    {"name":"Derrick Henry","pos":"RB","nflTeam":"BAL","rank":28},
    {"name":"Jeremiyah Love","pos":"RB","nflTeam":"ARI","rank":29},
    {"name":"Josh Jacobs","pos":"RB","nflTeam":"GB","rank":30},
    {"name":"Lamar Jackson","pos":"QB","nflTeam":"BAL","rank":31},
    {"name":"Tetairoa McMillan","pos":"WR","nflTeam":"CAR","rank":32},
    {"name":"Tee Higgins","pos":"WR","nflTeam":"CIN","rank":33},
    {"name":"DeVonta Smith","pos":"WR","nflTeam":"PHI","rank":34},
    {"name":"Drake Maye","pos":"QB","nflTeam":"NE","rank":35},
    {"name":"Garrett Wilson","pos":"WR","nflTeam":"NYJ","rank":36},
    {"name":"Colston Loveland","pos":"TE","nflTeam":"CHI","rank":37},
    {"name":"Kyren Williams","pos":"RB","nflTeam":"LAR","rank":38},
    {"name":"Breece Hall","pos":"RB","nflTeam":"NYJ","rank":39},
    {"name":"Javonte Williams","pos":"RB","nflTeam":"DAL","rank":40},
    {"name":"Davante Adams","pos":"WR","nflTeam":"LAR","rank":41},
    {"name":"Travis Etienne Jr.","pos":"RB","nflTeam":"NO","rank":42},
    {"name":"Zay Flowers","pos":"WR","nflTeam":"BAL","rank":43},
    {"name":"Ladd McConkey","pos":"WR","nflTeam":"LAC","rank":44},
    {"name":"Luther Burden III","pos":"WR","nflTeam":"CHI","rank":45},
    {"name":"Joe Burrow","pos":"QB","nflTeam":"CIN","rank":46},
    {"name":"Terry McLaurin","pos":"WR","nflTeam":"WAS","rank":47},
    {"name":"Bucky Irving","pos":"RB","nflTeam":"TB","rank":48},
    {"name":"Jaylen Waddle","pos":"WR","nflTeam":"DEN","rank":49},
    {"name":"Emeka Egbuka","pos":"WR","nflTeam":"TB","rank":50},
    {"name":"Jameson Williams","pos":"WR","nflTeam":"DET","rank":51},
    {"name":"Mike Evans","pos":"WR","nflTeam":"SF","rank":52},
    {"name":"Jayden Daniels","pos":"QB","nflTeam":"WAS","rank":53},
    {"name":"Cam Skattebo","pos":"RB","nflTeam":"NYG","rank":54},
    {"name":"TreVeyon Henderson","pos":"RB","nflTeam":"NE","rank":55},
    {"name":"Christian Watson","pos":"WR","nflTeam":"GB","rank":56},
    {"name":"D'Andre Swift","pos":"RB","nflTeam":"CHI","rank":57},
    {"name":"Quinshon Judkins","pos":"RB","nflTeam":"CLE","rank":58},
    {"name":"Jalen Hurts","pos":"QB","nflTeam":"PHI","rank":59},
    {"name":"David Montgomery","pos":"RB","nflTeam":"HOU","rank":60},
    {"name":"Tyler Warren","pos":"TE","nflTeam":"IND","rank":61},
    {"name":"DJ Moore","pos":"WR","nflTeam":"BUF","rank":62},
    {"name":"Tucker Kraft","pos":"TE","nflTeam":"GB","rank":63},
    {"name":"Rome Odunze","pos":"WR","nflTeam":"CHI","rank":64},
    {"name":"Bhayshul Tuten","pos":"RB","nflTeam":"JAC","rank":65},
    {"name":"Carnell Tate","pos":"WR","nflTeam":"TEN","rank":66},
    {"name":"Jadarian Price","pos":"RB","nflTeam":"SEA","rank":67},
    {"name":"Justin Herbert","pos":"QB","nflTeam":"LAC","rank":68},
    {"name":"Jaylen Warren","pos":"RB","nflTeam":"PIT","rank":69},
    {"name":"Caleb Williams","pos":"QB","nflTeam":"CHI","rank":70},
    {"name":"Chuba Hubbard","pos":"RB","nflTeam":"CAR","rank":71},
    {"name":"Marvin Harrison Jr.","pos":"WR","nflTeam":"ARI","rank":72},
    {"name":"Jaxson Dart","pos":"QB","nflTeam":"NYG","rank":73},
    {"name":"DK Metcalf","pos":"WR","nflTeam":"PIT","rank":74},
    {"name":"Courtland Sutton","pos":"WR","nflTeam":"DEN","rank":75},
    {"name":"Harold Fannin Jr.","pos":"TE","nflTeam":"CLE","rank":76},
    {"name":"Alec Pierce","pos":"WR","nflTeam":"IND","rank":77},
    {"name":"Jordyn Tyson","pos":"WR","nflTeam":"NO","rank":78},
    {"name":"Trevor Lawrence","pos":"QB","nflTeam":"JAC","rank":79},
    {"name":"RJ Harvey","pos":"RB","nflTeam":"DEN","rank":80},
    {"name":"Rico Dowdle","pos":"RB","nflTeam":"PIT","rank":81},
    {"name":"Michael Wilson","pos":"WR","nflTeam":"ARI","rank":82},
    {"name":"Rhamondre Stevenson","pos":"RB","nflTeam":"NE","rank":83},
    {"name":"Chris Godwin Jr.","pos":"WR","nflTeam":"TB","rank":84},
    {"name":"Dak Prescott","pos":"QB","nflTeam":"DAL","rank":85},
    {"name":"Sam LaPorta","pos":"TE","nflTeam":"DET","rank":86},
    {"name":"Kyle Pitts Sr.","pos":"TE","nflTeam":"ATL","rank":87},
    {"name":"Tony Pollard","pos":"RB","nflTeam":"TEN","rank":88},
    {"name":"Kyle Monangai","pos":"RB","nflTeam":"CHI","rank":89},
    {"name":"Brian Thomas Jr.","pos":"WR","nflTeam":"JAC","rank":90},
    {"name":"Makai Lemon","pos":"WR","nflTeam":"PHI","rank":91},
    {"name":"Brock Purdy","pos":"QB","nflTeam":"SF","rank":92},
    {"name":"Jakobi Meyers","pos":"WR","nflTeam":"JAC","rank":93},
    {"name":"Blake Corum","pos":"RB","nflTeam":"LAR","rank":94},
    {"name":"Parker Washington","pos":"WR","nflTeam":"JAC","rank":95},
    {"name":"Patrick Mahomes II","pos":"QB","nflTeam":"KC","rank":96},
    {"name":"J.K. Dobbins","pos":"RB","nflTeam":"DEN","rank":97},
    {"name":"Ricky Pearsall","pos":"WR","nflTeam":"SF","rank":98},
    {"name":"Matthew Stafford","pos":"QB","nflTeam":"LAR","rank":99},
    {"name":"Jordan Addison","pos":"WR","nflTeam":"MIN","rank":100},
    {"name":"Bo Nix","pos":"QB","nflTeam":"DEN","rank":101},
    {"name":"Michael Pittman Jr.","pos":"WR","nflTeam":"PIT","rank":102},
    {"name":"Dalton Kincaid","pos":"TE","nflTeam":"BUF","rank":103},
    {"name":"Jacory Croskey-Merritt","pos":"RB","nflTeam":"WAS","rank":104},
    {"name":"Wan'Dale Robinson","pos":"WR","nflTeam":"TEN","rank":105},
    {"name":"Aaron Jones Sr.","pos":"RB","nflTeam":"MIN","rank":106},
    {"name":"Jayden Reed","pos":"WR","nflTeam":"GB","rank":107},
    {"name":"Travis Kelce","pos":"TE","nflTeam":"KC","rank":108},
    {"name":"Jake Ferguson","pos":"TE","nflTeam":"DAL","rank":109},
    {"name":"Quentin Johnston","pos":"WR","nflTeam":"LAC","rank":110},
    {"name":"Jared Goff","pos":"QB","nflTeam":"DET","rank":111},
    {"name":"Kenneth Gainwell","pos":"RB","nflTeam":"TB","rank":112},
    {"name":"Kyler Murray","pos":"QB","nflTeam":"MIN","rank":113},
    {"name":"Josh Downs","pos":"WR","nflTeam":"IND","rank":114},
    {"name":"Oronde Gadsden II","pos":"TE","nflTeam":"LAC","rank":115},
    {"name":"George Kittle","pos":"TE","nflTeam":"SF","rank":116},
    {"name":"Rachaad White","pos":"RB","nflTeam":"WAS","rank":117},
    {"name":"Jordan Love","pos":"QB","nflTeam":"GB","rank":118},
    {"name":"Isaiah Likely","pos":"TE","nflTeam":"NYG","rank":119},
    {"name":"Dallas Goedert","pos":"TE","nflTeam":"PHI","rank":120},
    {"name":"Jayden Higgins","pos":"WR","nflTeam":"HOU","rank":121},
    {"name":"Jordan Mason","pos":"RB","nflTeam":"MIN","rank":122},
    {"name":"Tyler Allgeier","pos":"RB","nflTeam":"ARI","rank":123},
    {"name":"Khalil Shakir","pos":"WR","nflTeam":"BUF","rank":124},
    {"name":"Baker Mayfield","pos":"QB","nflTeam":"TB","rank":125},
    {"name":"Tyler Shough","pos":"QB","nflTeam":"NO","rank":126},
    {"name":"Tyrone Tracy Jr.","pos":"RB","nflTeam":"NYG","rank":127},
    {"name":"Woody Marks","pos":"RB","nflTeam":"HOU","rank":128},
    {"name":"Zach Charbonnet","pos":"RB","nflTeam":"SEA","rank":129},
    {"name":"Malik Willis","pos":"QB","nflTeam":"MIA","rank":130},
    {"name":"Romeo Doubs","pos":"WR","nflTeam":"NE","rank":131},
    {"name":"Xavier Worthy","pos":"WR","nflTeam":"KC","rank":132},
    {"name":"Chris Rodriguez Jr.","pos":"RB","nflTeam":"JAC","rank":133},
    {"name":"KC Concepcion","pos":"WR","nflTeam":"CLE","rank":134},
    {"name":"Jalen Coker","pos":"WR","nflTeam":"CAR","rank":135},
    {"name":"Juwan Johnson","pos":"TE","nflTeam":"NO","rank":136},
    {"name":"Matthew Golden","pos":"WR","nflTeam":"GB","rank":137},
    {"name":"Mark Andrews","pos":"TE","nflTeam":"BAL","rank":138},
    {"name":"Tyjae Spears","pos":"RB","nflTeam":"TEN","rank":139},
    {"name":"C.J. Stroud","pos":"QB","nflTeam":"HOU","rank":140},
    {"name":"Dylan Sampson","pos":"RB","nflTeam":"CLE","rank":141},
    {"name":"Jonathon Brooks","pos":"RB","nflTeam":"CAR","rank":142},
    {"name":"Brenton Strange","pos":"TE","nflTeam":"JAC","rank":143},
    {"name":"Isiah Pacheco","pos":"RB","nflTeam":"DET","rank":144},
    {"name":"Hunter Henry","pos":"TE","nflTeam":"NE","rank":145},
    {"name":"Alvin Kamara","pos":"RB","nflTeam":"NO","rank":146},
    {"name":"Jonah Coleman","pos":"RB","nflTeam":"DEN","rank":147},
    {"name":"Sam Darnold","pos":"QB","nflTeam":"SEA","rank":148},
    {"name":"Keaton Mitchell","pos":"RB","nflTeam":"LAC","rank":149},
    {"name":"Rashid Shaheed","pos":"WR","nflTeam":"SEA","rank":150},
    {"name":"James Conner","pos":"RB","nflTeam":"ARI","rank":151},
    {"name":"Braelon Allen","pos":"RB","nflTeam":"NYJ","rank":152},
    {"name":"Brian Robinson Jr.","pos":"RB","nflTeam":"ATL","rank":153},
    {"name":"Bryce Young","pos":"QB","nflTeam":"CAR","rank":154},
    {"name":"Denzel Boston","pos":"WR","nflTeam":"CLE","rank":155},
    {"name":"Emanuel Wilson","pos":"RB","nflTeam":"SEA","rank":156},
    {"name":"Tank Bigsby","pos":"RB","nflTeam":"PHI","rank":157},
    {"name":"Omar Cooper Jr.","pos":"WR","nflTeam":"NYJ","rank":158},
    {"name":"Jerry Jeudy","pos":"WR","nflTeam":"CLE","rank":159},
    {"name":"Travis Hunter","pos":"WR","nflTeam":"JAC","rank":160},
    {"name":"Brandon Aiyuk","pos":"WR","nflTeam":"SF","rank":161},
    {"name":"Emmett Johnson","pos":"RB","nflTeam":"KC","rank":162},
    {"name":"Stefon Diggs","pos":"WR","nflTeam":"FA","rank":163},
    {"name":"Jalen McMillan","pos":"WR","nflTeam":"TB","rank":164},
    {"name":"Kayshon Boutte","pos":"WR","nflTeam":"NE","rank":165},
    {"name":"Mike Washington Jr.","pos":"RB","nflTeam":"LV","rank":166},
    {"name":"Cam Ward","pos":"QB","nflTeam":"TEN","rank":167},
    {"name":"Jauan Jennings","pos":"WR","nflTeam":"MIN","rank":168},
    {"name":"Deebo Samuel Sr.","pos":"WR","nflTeam":"FA","rank":169},
    {"name":"Adonai Mitchell","pos":"WR","nflTeam":"NYJ","rank":170},
    {"name":"Dalton Schultz","pos":"TE","nflTeam":"HOU","rank":171},
    {"name":"Chig Okonkwo","pos":"TE","nflTeam":"WAS","rank":172},
    {"name":"Houston Texans","pos":"D/ST","nflTeam":"HOU","rank":173},
    {"name":"Antonio Williams","pos":"WR","nflTeam":"WAS","rank":174},
    {"name":"Nick Singleton","pos":"RB","nflTeam":"TEN","rank":175},
    {"name":"Kenyon Sadiq","pos":"TE","nflTeam":"NYJ","rank":176},
    {"name":"Kaytron Allen","pos":"RB","nflTeam":"WAS","rank":177},
    {"name":"Denver Broncos","pos":"D/ST","nflTeam":"DEN","rank":178},
    {"name":"Seattle Seahawks","pos":"D/ST","nflTeam":"SEA","rank":179},
    {"name":"Kimani Vidal","pos":"RB","nflTeam":"LAC","rank":180},
    {"name":"T.J. Hockenson","pos":"TE","nflTeam":"MIN","rank":181},
    {"name":"AJ Barner","pos":"TE","nflTeam":"SEA","rank":182},
    {"name":"Daniel Jones","pos":"QB","nflTeam":"IND","rank":183},
    {"name":"Tyreek Hill","pos":"WR","nflTeam":"FA","rank":184},
    {"name":"Los Angeles Rams","pos":"D/ST","nflTeam":"LAR","rank":185},
    {"name":"Philadelphia Eagles","pos":"D/ST","nflTeam":"PHI","rank":186},
    {"name":"Tre' Harris","pos":"WR","nflTeam":"LAC","rank":187},
    {"name":"Troy Franklin","pos":"WR","nflTeam":"DEN","rank":188},
    {"name":"Ray Davis","pos":"RB","nflTeam":"BUF","rank":189},
    {"name":"Jacoby Brissett","pos":"QB","nflTeam":"ARI","rank":190},
    {"name":"Jaylen Wright","pos":"RB","nflTeam":"MIA","rank":191},
    {"name":"Tre Tucker","pos":"WR","nflTeam":"LV","rank":192},
    {"name":"Jacksonville Jaguars","pos":"D/ST","nflTeam":"JAC","rank":193},
    {"name":"Pittsburgh Steelers","pos":"D/ST","nflTeam":"PIT","rank":194},
    {"name":"New England Patriots","pos":"D/ST","nflTeam":"NE","rank":195},
    {"name":"Brandon Aubrey","pos":"K","nflTeam":"DAL","rank":196},
    {"name":"Ka'imi Fairbairn","pos":"K","nflTeam":"HOU","rank":197},
    {"name":"Minnesota Vikings","pos":"D/ST","nflTeam":"MIN","rank":198},
    {"name":"Jaylin Noel","pos":"WR","nflTeam":"HOU","rank":199},
    {"name":"Sean Tucker","pos":"RB","nflTeam":"TB","rank":200},
    {"name":"Isaac TeSlaa","pos":"WR","nflTeam":"DET","rank":201},
    {"name":"Cameron Dicker","pos":"K","nflTeam":"LAC","rank":202},
    {"name":"Cam Little","pos":"K","nflTeam":"JAC","rank":203},
    {"name":"Cleveland Browns","pos":"D/ST","nflTeam":"CLE","rank":204},
    {"name":"Calvin Ridley","pos":"WR","nflTeam":"TEN","rank":205},
    {"name":"Demond Claiborne","pos":"RB","nflTeam":"MIN","rank":206},
    {"name":"Los Angeles Chargers","pos":"D/ST","nflTeam":"LAC","rank":207},
    {"name":"Jason Myers","pos":"K","nflTeam":"SEA","rank":208},
    {"name":"Darnell Mooney","pos":"WR","nflTeam":"NYG","rank":209},
    {"name":"Green Bay Packers","pos":"D/ST","nflTeam":"GB","rank":210},
    {"name":"Pat Bryant","pos":"WR","nflTeam":"DEN","rank":211},
    {"name":"Terrance Ferguson","pos":"TE","nflTeam":"LAR","rank":212},
    {"name":"Ryan Flournoy","pos":"WR","nflTeam":"DAL","rank":213},
    {"name":"Chris Bell","pos":"WR","nflTeam":"MIA","rank":214},
    {"name":"Eddy Pineiro","pos":"K","nflTeam":"SF","rank":215},
    {"name":"Germie Bernard","pos":"WR","nflTeam":"PIT","rank":216},
    {"name":"Dontayvion Wicks","pos":"WR","nflTeam":"PHI","rank":217},
    {"name":"Evan McPherson","pos":"K","nflTeam":"CIN","rank":218},
    {"name":"David Njoku","pos":"TE","nflTeam":"LAC","rank":219},
    {"name":"Fernando Mendoza","pos":"QB","nflTeam":"LV","rank":220},
    {"name":"Kansas City Chiefs","pos":"D/ST","nflTeam":"KC","rank":221},
    {"name":"Gunnar Helm","pos":"TE","nflTeam":"TEN","rank":222},
    {"name":"Tyler Loop","pos":"K","nflTeam":"BAL","rank":223},
    {"name":"Chimere Dike","pos":"WR","nflTeam":"TEN","rank":224},
    {"name":"De'Zhaun Stribling","pos":"WR","nflTeam":"SF","rank":225},
    {"name":"Baltimore Ravens","pos":"D/ST","nflTeam":"BAL","rank":226},
    {"name":"Andy Borregales","pos":"K","nflTeam":"NE","rank":227},
    {"name":"Cairo Santos","pos":"K","nflTeam":"CHI","rank":228},
    {"name":"Eli Stowers","pos":"TE","nflTeam":"PHI","rank":229},
    {"name":"Ollie Gordon II","pos":"RB","nflTeam":"MIA","rank":230},
    {"name":"Chase McLaughlin","pos":"K","nflTeam":"TB","rank":231},
    {"name":"Adam Randall","pos":"RB","nflTeam":"BAL","rank":232},
    {"name":"Devin Neal","pos":"RB","nflTeam":"NO","rank":233},
    {"name":"Jalen Nailor","pos":"WR","nflTeam":"LV","rank":234},
    {"name":"Tank Dell","pos":"WR","nflTeam":"HOU","rank":235},
    {"name":"Zachariah Branch","pos":"WR","nflTeam":"ATL","rank":236},
    {"name":"Ja'Kobi Lane","pos":"WR","nflTeam":"BAL","rank":237},
    {"name":"Trey Benson","pos":"RB","nflTeam":"ARI","rank":238},
    {"name":"Elijah Sarratt","pos":"WR","nflTeam":"BAL","rank":239},
    {"name":"Kaleb Johnson","pos":"RB","nflTeam":"PIT","rank":240},
    {"name":"Buffalo Bills","pos":"D/ST","nflTeam":"BUF","rank":241},
    {"name":"Cade Otton","pos":"TE","nflTeam":"TB","rank":242},
    {"name":"Skyler Bell","pos":"WR","nflTeam":"BUF","rank":243},
    {"name":"Detroit Lions","pos":"D/ST","nflTeam":"DET","rank":244},
    {"name":"Elic Ayomanor","pos":"WR","nflTeam":"TEN","rank":245},
    {"name":"Chris Brazzell II","pos":"WR","nflTeam":"CAR","rank":246},
    {"name":"Jake Bates","pos":"K","nflTeam":"DET","rank":247},
    {"name":"Malachi Fields","pos":"WR","nflTeam":"NYG","rank":248},
    {"name":"Harrison Butker","pos":"K","nflTeam":"KC","rank":249},
    {"name":"Kendre Miller","pos":"RB","nflTeam":"NO","rank":250},
    {"name":"Colby Parkinson","pos":"TE","nflTeam":"LAR","rank":251},
    {"name":"Najee Harris","pos":"RB","nflTeam":"LAC","rank":252},
    {"name":"Chris Boswell","pos":"K","nflTeam":"PIT","rank":253},
    {"name":"Rashod Bateman","pos":"WR","nflTeam":"BAL","rank":254},
    {"name":"Pat Freiermuth","pos":"TE","nflTeam":"PIT","rank":255},
    {"name":"Malik Washington","pos":"WR","nflTeam":"MIA","rank":256},
    {"name":"Kyle Williams","pos":"WR","nflTeam":"NE","rank":257},
    {"name":"Mason Taylor","pos":"TE","nflTeam":"NYJ","rank":258},
    {"name":"Geno Smith","pos":"QB","nflTeam":"NYJ","rank":259},
    {"name":"Tory Horton","pos":"WR","nflTeam":"SEA","rank":260},
    {"name":"Ted Hurst","pos":"WR","nflTeam":"TB","rank":261},
    {"name":"Harrison Mevis","pos":"K","nflTeam":"LAR","rank":262},
    {"name":"Isaiah Davis","pos":"RB","nflTeam":"NYJ","rank":263},
    {"name":"Jack Bech","pos":"WR","nflTeam":"LV","rank":264},
    {"name":"Cooper Kupp","pos":"WR","nflTeam":"SEA","rank":265},
    {"name":"Christian Kirk","pos":"WR","nflTeam":"SF","rank":266},
    {"name":"Michael Penix Jr.","pos":"QB","nflTeam":"ATL","rank":267},
    {"name":"Evan Engram","pos":"TE","nflTeam":"DEN","rank":268},
    {"name":"Brashard Smith","pos":"RB","nflTeam":"KC","rank":269},
    {"name":"Keon Coleman","pos":"WR","nflTeam":"BUF","rank":270},
    {"name":"Marvin Mims Jr.","pos":"WR","nflTeam":"DEN","rank":271},
    {"name":"Theo Johnson","pos":"TE","nflTeam":"NYG","rank":272},
    {"name":"Atlanta Falcons","pos":"D/ST","nflTeam":"ATL","rank":273},
    {"name":"Jordan James","pos":"RB","nflTeam":"SF","rank":274},
    {"name":"Ty Johnson","pos":"RB","nflTeam":"BUF","rank":275},
    {"name":"Wil Lutz","pos":"K","nflTeam":"DEN","rank":276},
    {"name":"Jake Tonges","pos":"TE","nflTeam":"SF","rank":277},
    {"name":"Jaydon Blue","pos":"RB","nflTeam":"DAL","rank":278},
    {"name":"Justice Hill","pos":"RB","nflTeam":"BAL","rank":279},
    {"name":"Mack Hollins","pos":"WR","nflTeam":"NE","rank":280},
    {"name":"Keenan Allen","pos":"WR","nflTeam":"LAC","rank":281},
    {"name":"Indianapolis Colts","pos":"D/ST","nflTeam":"IND","rank":282},
    {"name":"Shedeur Sanders","pos":"QB","nflTeam":"CLE","rank":283},
    {"name":"DJ Giddens","pos":"RB","nflTeam":"IND","rank":284},
    {"name":"Joe Mixon","pos":"RB","nflTeam":"FA","rank":285},
    {"name":"Max Klare","pos":"TE","nflTeam":"LAR","rank":286},
    {"name":"Will Reichard","pos":"K","nflTeam":"MIN","rank":287},
    {"name":"Chris Brooks","pos":"RB","nflTeam":"GB","rank":288},
    {"name":"George Holani","pos":"RB","nflTeam":"SEA","rank":289},
    {"name":"Seth McGowan","pos":"RB","nflTeam":"IND","rank":290},
    {"name":"Xavier Legette","pos":"WR","nflTeam":"CAR","rank":291},
    {"name":"Charlie Smyth","pos":"K","nflTeam":"NO","rank":292},
    {"name":"Darius Slayton","pos":"WR","nflTeam":"NYG","rank":293},
    {"name":"Jerome Ford","pos":"RB","nflTeam":"WAS","rank":294},
    {"name":"Isaac Guerendo","pos":"RB","nflTeam":"SF","rank":295},
    {"name":"San Francisco 49ers","pos":"D/ST","nflTeam":"SF","rank":296},
    {"name":"Aaron Rodgers","pos":"QB","nflTeam":"FA","rank":297},
    {"name":"Devin Singletary","pos":"RB","nflTeam":"NYG","rank":298},
    {"name":"Devaughn Vele","pos":"WR","nflTeam":"NO","rank":299},
    {"name":"MarShawn Lloyd","pos":"RB","nflTeam":"GB","rank":300},
    {"name":"Malik Davis","pos":"RB","nflTeam":"DAL","rank":301},
    {"name":"Emari Demercado","pos":"RB","nflTeam":"KC","rank":302},
    {"name":"LeQuint Allen Jr.","pos":"RB","nflTeam":"JAC","rank":303},
    {"name":"Greg Dulcich","pos":"TE","nflTeam":"MIA","rank":304},
    {"name":"Mike Gesicki","pos":"TE","nflTeam":"CIN","rank":305},
    {"name":"Tua Tagovailoa","pos":"QB","nflTeam":"ATL","rank":306},
    {"name":"Jaleel McLaughlin","pos":"RB","nflTeam":"DEN","rank":307},
    {"name":"Hollywood Brown","pos":"WR","nflTeam":"PHI","rank":308},
    {"name":"Samaje Perine","pos":"RB","nflTeam":"CIN","rank":309},
    {"name":"Tyquan Thornton","pos":"WR","nflTeam":"KC","rank":310},
    {"name":"Oscar Delp","pos":"TE","nflTeam":"NO","rank":311},
    {"name":"Ty Simpson","pos":"QB","nflTeam":"LAR","rank":312},
    {"name":"Isaiah Bond","pos":"WR","nflTeam":"CLE","rank":313},
    {"name":"Audric Estime","pos":"RB","nflTeam":"NO","rank":314},
    {"name":"Tahj Brooks","pos":"RB","nflTeam":"CIN","rank":315},
    {"name":"Kirk Cousins","pos":"QB","nflTeam":"LV","rank":316},
    {"name":"Kaelon Black","pos":"RB","nflTeam":"SF","rank":317},
    {"name":"Trevor Etienne","pos":"RB","nflTeam":"CAR","rank":318},
    {"name":"Deshaun Watson","pos":"QB","nflTeam":"CLE","rank":319},
    {"name":"Jarquez Hunter","pos":"RB","nflTeam":"LAR","rank":320},
    {"name":"J.J. McCarthy","pos":"QB","nflTeam":"MIN","rank":321},
    {"name":"Kareem Hunt","pos":"RB","nflTeam":"FA","rank":322},
    {"name":"Andrei Iosivas","pos":"WR","nflTeam":"CIN","rank":323},
    {"name":"Cedric Tillman","pos":"WR","nflTeam":"CLE","rank":324},
    {"name":"Calvin Austin III","pos":"WR","nflTeam":"NYG","rank":325},
    {"name":"Konata Mumpfield","pos":"WR","nflTeam":"LAR","rank":326},
    {"name":"Luke McCaffrey","pos":"WR","nflTeam":"WAS","rank":327},
    {"name":"Bam Knight","pos":"RB","nflTeam":"ARI","rank":328},
    {"name":"New Orleans Saints","pos":"D/ST","nflTeam":"NO","rank":329},
    {"name":"Will Shipley","pos":"RB","nflTeam":"PHI","rank":330},
    {"name":"Jahan Dotson","pos":"WR","nflTeam":"ATL","rank":331},
    {"name":"Mac Jones","pos":"QB","nflTeam":"SF","rank":332},
    {"name":"Tez Johnson","pos":"WR","nflTeam":"TB","rank":333},
    {"name":"Chicago Bears","pos":"D/ST","nflTeam":"CHI","rank":334},
    {"name":"Carolina Panthers","pos":"D/ST","nflTeam":"CAR","rank":335},
    {"name":"Jalen Royals","pos":"WR","nflTeam":"KC","rank":336},
    {"name":"Nick Chubb","pos":"RB","nflTeam":"FA","rank":337},
    {"name":"Dallas Cowboys","pos":"D/ST","nflTeam":"DAL","rank":338},
    {"name":"Zane Gonzalez","pos":"K","nflTeam":"MIA","rank":339},
    {"name":"Michael Carter","pos":"RB","nflTeam":"TEN","rank":340},
    {"name":"Austin Ekeler","pos":"RB","nflTeam":"FA","rank":341},
    {"name":"Darnell Washington","pos":"TE","nflTeam":"PIT","rank":342},
    {"name":"Caleb Douglas","pos":"WR","nflTeam":"MIA","rank":343},
    {"name":"Miami Dolphins","pos":"D/ST","nflTeam":"MIA","rank":344},
    {"name":"Brenen Thompson","pos":"WR","nflTeam":"LAC","rank":345},
    {"name":"Bryce Lance","pos":"WR","nflTeam":"NO","rank":346},
    {"name":"Treylon Burks","pos":"WR","nflTeam":"WAS","rank":347},
    {"name":"Olamide Zaccheaus","pos":"WR","nflTeam":"ATL","rank":348},
    {"name":"Eli Heidenreich","pos":"RB","nflTeam":"PIT","rank":349},
    {"name":"Tyler Higbee","pos":"TE","nflTeam":"LAR","rank":350},
    {"name":"John Metchie III","pos":"WR","nflTeam":"CAR","rank":351},
    {"name":"Jalen Tolbert","pos":"WR","nflTeam":"MIA","rank":352},
    {"name":"Joshua Palmer","pos":"WR","nflTeam":"BUF","rank":353},
    {"name":"Dont'e Thornton Jr.","pos":"WR","nflTeam":"LV","rank":354},
    {"name":"Xavier Hutchinson","pos":"WR","nflTeam":"HOU","rank":355},
    {"name":"Savion Williams","pos":"WR","nflTeam":"GB","rank":356},
    {"name":"Anthony Richardson Sr.","pos":"QB","nflTeam":"IND","rank":357},
    {"name":"Blake Grupe","pos":"K","nflTeam":"IND","rank":358},
    {"name":"Noah Gray","pos":"TE","nflTeam":"KC","rank":359},
    {"name":"Jaylin Lane","pos":"WR","nflTeam":"WAS","rank":360},
    {"name":"Justin Fields","pos":"QB","nflTeam":"KC","rank":361},
    {"name":"Justin Joly","pos":"TE","nflTeam":"DEN","rank":362},
    {"name":"DeMario Douglas","pos":"WR","nflTeam":"NE","rank":363},
    {"name":"Tutu Atwell","pos":"WR","nflTeam":"MIA","rank":364},
    {"name":"Tommy Myers","pos":"TE","nflTeam":"FA","rank":365},
    {"name":"Jake Elliott","pos":"K","nflTeam":"PHI","rank":366},
    {"name":"New York Giants","pos":"D/ST","nflTeam":"NYG","rank":367},
    {"name":"KaVontae Turpin","pos":"WR","nflTeam":"DAL","rank":368},
    {"name":"John Bates","pos":"TE","nflTeam":"WAS","rank":369},
    {"name":"Washington Commanders","pos":"D/ST","nflTeam":"WAS","rank":370},
    {"name":"Elijah Arroyo","pos":"TE","nflTeam":"SEA","rank":371},
    {"name":"Raheim Sanders","pos":"RB","nflTeam":"CLE","rank":372},
    {"name":"Ja'Tavion Sanders","pos":"TE","nflTeam":"CAR","rank":373},
    {"name":"Kevin Coleman Jr.","pos":"WR","nflTeam":"MIA","rank":374},
    {"name":"Chad Ryland","pos":"K","nflTeam":"ARI","rank":375},
    {"name":"Michael Mayer","pos":"TE","nflTeam":"LV","rank":376},
    {"name":"Cyrus Allen","pos":"WR","nflTeam":"KC","rank":377},
    {"name":"Darren Waller","pos":"TE","nflTeam":"FA","rank":378},
    {"name":"Luke Musgrave","pos":"TE","nflTeam":"GB","rank":379},
    {"name":"Kendrick Bourne","pos":"WR","nflTeam":"ARI","rank":380},
    {"name":"Antonio Gibson","pos":"RB","nflTeam":"FA","rank":381},
    {"name":"Dameon Pierce","pos":"RB","nflTeam":"PHI","rank":382},
    {"name":"Jawhar Jordan","pos":"RB","nflTeam":"HOU","rank":383},
    {"name":"J'Mari Taylor","pos":"RB","nflTeam":"JAC","rank":384},
    {"name":"Dyami Brown","pos":"WR","nflTeam":"WAS","rank":385},
    {"name":"Cincinnati Bengals","pos":"D/ST","nflTeam":"CIN","rank":386},
    {"name":"Cole Kmet","pos":"TE","nflTeam":"CHI","rank":387},
    {"name":"Noah Fant","pos":"TE","nflTeam":"NO","rank":388},
    {"name":"Nick Westbrook-Ikhine","pos":"WR","nflTeam":"IND","rank":389},
    {"name":"Tyler Bass","pos":"K","nflTeam":"BUF","rank":390},
    {"name":"Carson Beck","pos":"QB","nflTeam":"ARI","rank":391},
    {"name":"Kalif Raymond","pos":"WR","nflTeam":"CHI","rank":392},
    {"name":"Joey Slye","pos":"K","nflTeam":"TEN","rank":393},
    {"name":"Ben Sinnott","pos":"TE","nflTeam":"WAS","rank":394},
    {"name":"Terrell Jennings","pos":"RB","nflTeam":"NE","rank":395},
    {"name":"Deion Burks","pos":"WR","nflTeam":"IND","rank":396},
    {"name":"Zach Ertz","pos":"TE","nflTeam":"FA","rank":397},
    {"name":"Dawson Knox","pos":"TE","nflTeam":"BUF","rank":398},
    {"name":"Brandon McManus","pos":"K","nflTeam":"FA","rank":399},
    {"name":"Joe Milton III","pos":"QB","nflTeam":"DAL","rank":400},
    {"name":"Jameis Winston","pos":"QB","nflTeam":"NYG","rank":401},
    {"name":"Phil Mafah","pos":"RB","nflTeam":"DAL","rank":402},
    {"name":"Jordan Whittington","pos":"WR","nflTeam":"LAR","rank":403},
    {"name":"Tai Felton","pos":"WR","nflTeam":"MIN","rank":404},
    {"name":"CJ Daniels","pos":"WR","nflTeam":"LAR","rank":405},
    {"name":"Mitchell Evans","pos":"TE","nflTeam":"CAR","rank":406},
    {"name":"Daniel Bellinger","pos":"TE","nflTeam":"TEN","rank":407},
    {"name":"Jonnu Smith","pos":"TE","nflTeam":"FA","rank":408},
    {"name":"Damien Martinez","pos":"RB","nflTeam":"GB","rank":409},
    {"name":"Eli Raridon","pos":"TE","nflTeam":"NE","rank":410},
    {"name":"Zavion Thomas","pos":"WR","nflTeam":"CHI","rank":411},
    {"name":"Demarcus Robinson","pos":"WR","nflTeam":"SF","rank":412},
    {"name":"Elijah Higgins","pos":"TE","nflTeam":"ARI","rank":413},
    {"name":"Gardner Minshew II","pos":"QB","nflTeam":"ARI","rank":414},
    {"name":"Sam Roush","pos":"TE","nflTeam":"CHI","rank":415},
    {"name":"Devontez Walker","pos":"WR","nflTeam":"BAL","rank":416},
    {"name":"Greg Dortch","pos":"WR","nflTeam":"DET","rank":417},
    {"name":"Marcus Mariota","pos":"QB","nflTeam":"WAS","rank":418},
    {"name":"Roman Wilson","pos":"WR","nflTeam":"FA","rank":419},
    {"name":"Tommy Tremble","pos":"TE","nflTeam":"CAR","rank":420},
    {"name":"Malik Benson","pos":"WR","nflTeam":"LV","rank":421},
    {"name":"Jackson Hawes","pos":"TE","nflTeam":"BUF","rank":422}];
    window.__ldPlayerPool = _ldPlayerPool; // expose for keeper portal rookie-position lookup
    // Identify Restricted FAs (TBD-value roster players) and which team holds their rights
    const _rfa = {}; // normalizedName -> { name, team, pos }
    for (const [team, roster] of Object.entries(window._ldBaseRosters || LEAGUE_DATA.rosters || {})) {
      for (const r of roster) {
        if (r.val2026 === 'TBD' && r.player) {
          _rfa[normalizeName(r.player)] = { name: r.player, team, pos: (r.pos || '').replace(/\d+$/, '') };
        }
      }
    }
    // Tag RFAs that are already in the pool, and inject any that aren't —
    // Restricted FAs stay draftable but are flagged with their rights-holding team.
    const _poolNames = new Set(_ldPlayerPool.map(p => normalizeName(p.name)));
    for (const p of _ldPlayerPool) {
      const info = _rfa[normalizeName(p.name)];
      if (info) { p.rfa = true; p.rightsTeam = info.team; }
    }
    for (const key in _rfa) {
      if (!_poolNames.has(key)) {
        const info = _rfa[key];
        _ldPlayerPool.push({ name: info.name, pos: info.pos, nflTeam: '', rank: 9999, rfa: true, rightsTeam: info.team });
        _poolNames.add(key);
      }
    }
    updatePlayerDropdown();
    renderTopAvailable();
  }

  function normalizeName(n) {
    return (n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function updatePoolStatus(msg, cls) {
    const el = document.getElementById('ld-pool-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'ld-pool-status' + (cls ? ' ' + cls : '');
  }

  // Return pool players not already on any roster.
  // TBD-value players (Restricted FAs) are treated as available — they remain draftable.
  function getAvailablePlayers() {
    const rostered = new Set();
    for (const roster of Object.values(LEAGUE_DATA.rosters || {})) {
      for (const r of roster) {
        if (r.player && r.val2026 !== 'TBD') rostered.add(normalizeName(r.player));
      }
    }
    // Also drop anyone already drafted on the live board, so a just-picked
    // player can't reappear in the pool if the roster snapshot briefly lags
    // (e.g. right after the board is cleared on finalize).
    for (const p of (_allPicks || [])) {
      if (p.player) rostered.add(normalizeName(p.player));
    }
    return _ldPlayerPool.filter(p => !rostered.has(normalizeName(p.name)));
  }

  function updatePlayerDropdown() {
    const dl = document.getElementById('ld-players-list');
    if (!dl) return;
    const avail = getAvailablePlayers();
    dl.innerHTML = avail
      .map(p => `<option value="${escHtml(p.name)}">${escHtml(p.name)} (${escHtml(p.pos)}${p.rfa ? ' – RFA: ' + escHtml(p.rightsTeam || '') : (p.nflTeam ? ' – ' + escHtml(p.nflTeam) : '')})</option>`)
      .join('');
  }

  // Shared row markup for both the mini per-position cards and the full-list modal.
  function posPlayerRowHtml(p) {
    return `<div class="ld-top-player">
      <span class="ld-top-rank">${p.rank < 9999 ? p.rank : '—'}</span>
      <span class="ld-top-pname">${escHtml(p.name)}${p.rfa ? '<span class="ld-rfa-badge">RFA</span>' : ''}</span>
      <span class="ld-top-pteam${p.rfa ? ' rfa' : ''}"${p.rfa ? ` title="RFA rights: ${escHtml(p.rightsTeam || '')}"` : ''}>${p.rfa ? escHtml(p.rightsTeam || 'RFA') : (p.nflTeam ? escHtml(p.nflTeam) : 'TBD')}</span>
    </div>`;
  }

  const POS_FULL_LABELS = { QB:'Quarterbacks', RB:'Running Backs', WR:'Wide Receivers', TE:'Tight Ends', DST:'Defense / Special Teams', K:'Kickers' };
  let _ldAvailByPos = {};   // last-rendered available players, grouped by position — reused by the modal
  let _openPosModal = null; // position currently shown in the full-list modal, or null

  function renderTopAvailable() {
    const container = document.getElementById('ld-top-available');
    if (!container) return;
    const avail = getAvailablePlayers();
    const positions = ['QB','RB','WR','TE','DST','K'];
    const posColors = { QB:'var(--qb)', RB:'var(--rb)', WR:'var(--wr)', TE:'var(--te)', DST:'var(--dst)', K:'var(--k)' };
    const byPos = {};
    for (const pos of positions) byPos[pos] = [];
    for (const p of avail) {
      const key = p.pos.replace(/\d+$/, '').toUpperCase().replace('D/ST', 'DST');
      if (byPos[key]) byPos[key].push(p);
    }
    _ldAvailByPos = byPos;
    container.innerHTML = '<div class="ld-top-avail-hdr">Top Available by Position <span class="ld-top-avail-hint">— scroll a column, or click its name for the full list</span></div>' +
      '<div class="ld-top-pos-grid">' +
      positions.map(pos => {
        const players = byPos[pos];
        if (!players.length) return '';
        const color = posColors[pos] || 'var(--green)';
        return `<div class="ld-top-pos">
          <div class="ld-top-pos-hdr" data-pos="${pos}" tabindex="0" role="button" title="Click to see the full ${pos} list" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${color};margin-bottom:5px;padding-bottom:4px;border-bottom:1px solid ${color}">${pos} <span class="ld-top-pos-count">(${players.length})</span><span class="ld-top-pos-expand">⤢</span></div>
          <div class="ld-top-pos-list">${players.map(posPlayerRowHtml).join('')}</div>
        </div>`;
      }).join('') +
      '</div>';
    // If a manager currently has the full-list modal open, keep it live too —
    // otherwise a player drafted by someone else would still show as available.
    if (_openPosModal) renderPosModalContent(_openPosModal);
  }

  function renderPosModalContent(pos) {
    const title = document.getElementById('ld-pos-modal-title');
    const list  = document.getElementById('ld-pos-modal-list');
    const players = _ldAvailByPos[pos] || [];
    if (title) title.textContent = `${POS_FULL_LABELS[pos] || pos} — ${players.length} available`;
    if (list) list.innerHTML = players.length
      ? players.map(posPlayerRowHtml).join('')
      : '<div class="ld-pos-modal-empty">No players left at this position.</div>';
  }

  function openPosModal(pos) {
    _openPosModal = pos;
    renderPosModalContent(pos);
    const overlay = document.getElementById('ld-pos-modal-overlay');
    if (overlay) overlay.classList.add('open');
  }

  function closePosModal() {
    _openPosModal = null;
    const overlay = document.getElementById('ld-pos-modal-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  // Look up a player's position from the draft pool (used to auto-detect position).
  function posForPlayer(name) {
    const n = normalizeName(name);
    const hit = _ldPlayerPool.find(p => normalizeName(p.name) === n);
    if (!hit) return '';
    const pos = String(hit.pos || '').replace(/\d+$/, '').toUpperCase();
    if (pos === 'DST' || pos === 'DEF' || pos === 'D/ST') return 'D/ST';
    return pos;
  }

  // ── Auction nomination order ──────────────────────────────────────────────
  // Fixed manager order, wrapping 1→12→1. Teams that are full (16 players) or out
  // of money ($200 spent) are skipped. The pointer advances one slot per completed
  // pick — nomination is independent of who actually won the player.
  const NOMINATION_ORDER = ['JAMES','COLLIN','ADAM/MATT','BLAKE','MIKE','CASEY','BRAD','JEFF','KYLE','CAMPBELL','BRADEN','BOBBY'];

  function nominationTeams() {
    const mgrs = LEAGUE_DATA.managers || {};
    return NOMINATION_ORDER
      .map(key => ({ key, team: mgrs[key] }))
      .filter(x => x.team);
  }

  function teamIsEligible(team) {
    const b = LEAGUE_DATA.budgets && LEAGUE_DATA.budgets[team];
    const roster = (LEAGUE_DATA.rosters && LEAGUE_DATA.rosters[team]) || [];
    const kept    = b ? parseInt(b.totalKept)   || 0 : 0;
    const players = b ? parseInt(b.playerCount) || roster.filter(r => r.val2026 !== 'TBD').length : roster.filter(r => r.val2026 !== 'TBD').length;
    return players < 16 && kept < 200;
  }

  function renderNominationStrip() {
    const el = document.getElementById('ld-nom-strip');
    if (!el) return;
    const order = nominationTeams();
    if (!order.length) { el.style.display = 'none'; return; }
    el.style.display = '';
    const base = _allPicks.length % order.length;
    let currentIdx = -1;
    for (let s = 0; s < order.length; s++) {
      const i = (base + s) % order.length;
      if (teamIsEligible(order[i].team)) { currentIdx = i; break; }
    }
    const cur = currentIdx >= 0 ? order[currentIdx] : null;
    el.innerHTML =
      `<div class="ld-nom-hdr">🗣️ Nomination order ${cur
        ? `— up now: <strong>#${currentIdx + 1} ${escHtml(cur.team)}</strong> <span class="ld-nom-mgr">(${escHtml(cur.key)})</span>`
        : '— all teams are full'}</div>` +
      `<div class="ld-nom-list">` +
      order.map((o, i) => {
        const elig  = teamIsEligible(o.team);
        const isCur = i === currentIdx;
        return `<span class="ld-nom-chip${isCur ? ' current' : ''}${elig ? '' : ' out'}" title="${escHtml(o.team)}${elig ? '' : ' — full / out of money'}">${i + 1}. ${escHtml(o.key)}</span>`;
      }).join('') +
      `</div>`;
  }

  function subscribeToPicksFeed() {
    renderTeamPanels();
    const ref = window._fbDb.ref('live_draft/picks');
    ref.on('value', snap => {
      const raw = snap.val() || {};
      _allPicks = Object.entries(raw)
        .map(([key, val]) => ({ ...val, _key: key }))
        .sort((a, b) => (a.pickNum || 0) - (b.pickNum || 0));

      rebuildRostersFromPicks(_allPicks);

      // Re-render rosters page live so picks appear instantly
      if (typeof buildRosters === 'function') buildRosters();

      // Commissioner's client pushes updated rosters/budgets to Firebase
      if (window.commMode && window.commMode.isUnlocked()) {
        window.fbSet && window.fbSet('league_data/leagueData', JSON.stringify(LEAGUE_DATA));
        window.fbSet && window.fbSet('league_data/rosters',  LEAGUE_DATA.rosters);
        window.fbSet && window.fbSet('league_data/budgets',  LEAGUE_DATA.budgets);
        window.fbSet && window.fbSet('league_data/_version', Date.now());
      }

      renderBoard(_allPicks);
      renderTeamPanels();
      updateTeamDropdown();
      updatePlayerDropdown();
      renderTopAvailable();
      renderNominationStrip();

      const statusEl = document.getElementById('ld-status-bar');
      if (statusEl) {
        if (_allPicks.length === 0) {
          statusEl.className = 'ld-status-bar';
          statusEl.innerHTML = '<span style="color:var(--text-muted)">Auction draft has not started yet.</span>';
        } else {
          const last = _allPicks[_allPicks.length - 1];
          statusEl.className = 'ld-status-bar ld-live-banner';
          statusEl.innerHTML =
            `<span class="ld-live-dot"></span>` +
            `<span><strong>LIVE</strong> — Auction Draft in progress</span>` +
            `<span class="ld-live-count">${_allPicks.length} player${_allPicks.length === 1 ? '' : 's'} drafted</span>` +
            (last ? `<span class="ld-last-pick">Last: ${escHtml(last.player || '')} → ${escHtml(last.team || '')}${last.bid ? ` ($${last.bid})` : ''}</span>` : '');
        }
      }
    });
  }

  /* ── Rebuild LEAGUE_DATA rosters+budgets from base keepers + all picks ───── */
  function rebuildRostersFromPicks(picks) {
    if (!window._ldBaseRosters) return;
    LEAGUE_DATA.rosters = JSON.parse(JSON.stringify(window._ldBaseRosters));
    LEAGUE_DATA.budgets  = JSON.parse(JSON.stringify(window._ldBaseBudgets));
    for (const p of picks) {
      if (!p.team) continue;
      if (!LEAGUE_DATA.rosters[p.team]) LEAGUE_DATA.rosters[p.team] = [];
      LEAGUE_DATA.rosters[p.team].push({
        player: p.player || '', pos: p.pos || '',
        val2026: String(p.bid || 0), val2025: '0', rookieDeal: 'N'
      });
    }
    for (const team of Object.keys(LEAGUE_DATA.budgets || {})) {
      const b      = LEAGUE_DATA.budgets[team];
      const roster = LEAGUE_DATA.rosters[team] || [];
      const totalKept = roster.reduce((s, r) => s + (parseInt(r.val2026) || 0), 0);
      const budget    = parseInt(b.budget) || 200;
      b.totalKept    = String(totalKept);
      b.playerCount  = String(roster.filter(r => r.val2026 !== 'TBD').length);
      b.remaining    = String(budget - totalKept);
      b.inSeasonFaab = String(budget - totalKept + 25);
    }
  }

  /* ── Render team sidebar panels ─────────────────────────────────────────── */
  function renderTeamPanels() {
    const leftEl  = document.getElementById('ld-panel-left');
    const rightEl = document.getElementById('ld-panel-right');
    if (!leftEl || !rightEl) return;

    const teams = (LEAGUE_DATA.teams || Object.keys(LEAGUE_DATA.rosters || {})).slice().sort();
    const mid   = Math.ceil(teams.length / 2);
    const leftTeams  = teams.slice(0, mid);
    const rightTeams = teams.slice(mid);

    function teamCardHtml(team) {
      const roster  = LEAGUE_DATA.rosters[team] || [];
      const budget  = LEAGUE_DATA.budgets && LEAGUE_DATA.budgets[team];
      const kept    = budget ? parseInt(budget.totalKept)   || 0 : 0;
      const players = budget ? parseInt(budget.playerCount) || roster.filter(r => r.val2026 !== 'TBD').length : roster.filter(r => r.val2026 !== 'TBD').length;
      const rem     = budget ? parseInt(budget.remaining)   : (200 - kept);

      const maxPlayers = players >= 16;
      const maxBudget  = kept >= 200;
      const faded      = maxPlayers || maxBudget;

      const keptClass    = maxBudget  ? ' maxed' : '';
      const playersClass = maxPlayers ? ' maxed' : '';

      return `<div class="ld-team-card clickable${faded ? ' faded' : ''}" data-team="${escHtml(team)}" title="View ${escHtml(team)}'s roster">
        <div class="ld-tc-name">${escHtml(team)}</div>
        <div class="ld-tc-stats">
          <div class="ld-tc-row">
            <span>Players</span>
            <span class="ld-tc-val${playersClass}">${players}/16</span>
          </div>
          <div class="ld-tc-row">
            <span>Kept $</span>
            <span class="ld-tc-val${keptClass}">$${kept}</span>
          </div>
          <div class="ld-tc-row">
            <span>Rem</span>
            <span class="ld-tc-val">${rem >= 0 ? '+' : ''}$${rem}</span>
          </div>
        </div>
      </div>`;
    }

    leftEl.innerHTML  = '<div class="ld-tc-panel-label">Teams</div>' + leftTeams.map(teamCardHtml).join('');
    rightEl.innerHTML = '<div class="ld-tc-panel-label">Teams</div>' + rightTeams.map(teamCardHtml).join('');

    // Click a team to jump to its (live-updating) roster page.
    [leftEl, rightEl].forEach(panel => {
      panel.querySelectorAll('.ld-team-card[data-team]').forEach(card => {
        card.addEventListener('click', () => {
          const t = card.dataset.team;
          if (window.showTeamDetail) window.showTeamDetail(t);
        });
      });
    });
  }

  /* ── Render the draft board ──────────────────────────────────────────────── */
  function renderBoard(picks) {
    const board = document.getElementById('ld-board');
    if (!board) return;
    const isComm = !!(window.commMode && window.commMode.isUnlocked());
    board.className = 'ld-board' + (isComm ? ' ld-comm-active' : '');
    if (!picks.length) {
      board.innerHTML = '<div class="te-empty" style="text-align:center;padding:32px">Waiting for the draft to begin…</div>';
      return;
    }
    const teamOpts = (LEAGUE_DATA.teams||[]).map(t=>`<option value="${escHtml(t)}">${escHtml(t)}</option>`).join('');
    // Auction draft — no fixed rounds, so render every pick in one continuous row.
    // Newest picks first (top); older picks flow down. Pick numbers still reflect
    // the actual draft order, so the most recent shows the highest number.
    board.innerHTML = `<div class="ld-picks-row">` +
      picks.slice().reverse().map((p, i) => `
            <div class="ld-pick-card" data-key="${escHtml(p._key||'')}">
              <div class="ld-pick-num">#${picks.length - i}</div>
              <div class="ld-pick-actions">
                <button class="ld-pick-act-btn edit" title="Edit">✏</button>
                <button class="ld-pick-act-btn del"  title="Delete">✕</button>
              </div>
              <div class="ld-pick-pos pos-${(p.pos||'').toLowerCase().replace('/','')}">${p.pos||''}</div>
              <div class="ld-pick-player">${escHtml(p.player||'')}</div>
              <div class="ld-pick-team">${escHtml(p.team||'')}</div>
              ${p.bid ? `<div class="ld-pick-bid">$${p.bid}</div>` : ''}
            </div>`).join('') +
      `</div>`;

    if (isComm) {
      board.querySelectorAll('.ld-pick-act-btn.edit').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const card = btn.closest('.ld-pick-card');
          const pick = _allPicks.find(p => p._key === card.dataset.key);
          if (pick) openEditCard(card, pick, teamOpts);
        });
      });
      board.querySelectorAll('.ld-pick-act-btn.del').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const card = btn.closest('.ld-pick-card');
          const pick = _allPicks.find(p => p._key === card.dataset.key);
          if (pick && confirm(`Delete pick #${pick.pickNum}: ${pick.player} → ${pick.team}?`)) {
            deletePick(pick._key);
          }
        });
      });
    }
  }

  /* ── Inline edit a pick card ─────────────────────────────────────────────── */
  function openEditCard(card, pick, teamOpts) {
    const pickNumText = card.querySelector('.ld-pick-num').textContent;
    card.classList.add('ld-editing');
    const selTeam = teamOpts.replace(`value="${escHtml(pick.team)}"`, `value="${escHtml(pick.team)}" selected`);
    const posOpts = ['QB','RB','WR','TE','K','D/ST'].map(p =>
      `<option value="${p}"${p===pick.pos?' selected':''}>${p}</option>`).join('');
    card.innerHTML = `
      <div class="ld-pick-num">${pickNumText}</div>
      <select class="ld-edit-field ld-et">${selTeam}</select>
      <input  class="ld-edit-field ld-ep" value="${escHtml(pick.player||'')}" placeholder="Player name" />
      <select class="ld-edit-field ld-eo">${posOpts}</select>
      <input  class="ld-edit-field ld-eb" type="number" min="1" value="${pick.bid||''}" placeholder="Auction $" />
      <div class="ld-edit-actions">
        <button class="ld-edit-save-btn">✅ Save</button>
        <button class="ld-edit-cancel-btn">Cancel</button>
      </div>`;

    card.querySelector('.ld-edit-cancel-btn').addEventListener('click', () => renderBoard(_allPicks));

    // Auto-detect position when the player name changes.
    const epInp = card.querySelector('.ld-ep');
    const eoSel = card.querySelector('.ld-eo');
    if (epInp && eoSel) {
      const autoPos = () => { const p = posForPlayer(epInp.value.trim()); if (p) eoSel.value = p; };
      epInp.addEventListener('input', autoPos);
      epInp.addEventListener('change', autoPos);
    }

    card.querySelector('.ld-edit-save-btn').addEventListener('click', async () => {
      const newTeam   = card.querySelector('.ld-et').value;
      const newPlayer = card.querySelector('.ld-ep').value.trim();
      const newPos    = posForPlayer(newPlayer) || card.querySelector('.ld-eo').value;
      const newBid    = parseInt(card.querySelector('.ld-eb').value);
      if (!newTeam)           { alert('Please select a team.'); return; }
      if (!newPlayer)         { alert('Please enter a player name.'); return; }
      if (!newPos)            { alert('Could not detect a position — pick one from the dropdown.'); return; }
      if (!newBid || newBid < 1) { alert('Please enter an auction value ($1 or more).'); return; }
      // Cap check — exclude this pick's current contribution if it stays on the same team.
      {
        const eb = LEAGUE_DATA.budgets && LEAGUE_DATA.budgets[newTeam];
        const er = (LEAGUE_DATA.rosters && LEAGUE_DATA.rosters[newTeam]) || [];
        let kept    = eb ? parseInt(eb.totalKept)   || 0 : 0;
        let players = eb ? parseInt(eb.playerCount) || er.filter(r => r.val2026 !== 'TBD').length : er.filter(r => r.val2026 !== 'TBD').length;
        if (pick.team === newTeam) { kept -= (parseInt(pick.bid) || 0); players -= 1; }
        if (players + 1 > 16)   { alert(`${newTeam} would exceed 16 players.`); return; }
        if (kept + newBid > 200) { alert(`${newTeam} only has $${200 - kept} of cap room — a $${newBid} bid would put them over $200.`); return; }
      }
      const saveBtn = card.querySelector('.ld-edit-save-btn');
      saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
      try {
        await window._fbDb.ref(`live_draft/picks/${pick._key}`).update({
          team: newTeam, player: newPlayer, pos: newPos, bid: newBid
        });
        // listener will re-render automatically
      } catch(e) {
        alert('Failed to save: ' + e.message);
        saveBtn.disabled = false; saveBtn.textContent = '✅ Save';
      }
    });
  }

  /* ── Delete a single pick ────────────────────────────────────────────────── */
  async function deletePick(key) {
    try {
      await window._fbDb.ref(`live_draft/picks/${key}`).remove();
      // listener re-renders automatically
    } catch(e) { alert('Failed to delete pick: ' + e.message); }
  }

  /* ── Refresh team dropdown – disable maxed-out teams ────────────────────── */
  function updateTeamDropdown() {
    const sel = document.getElementById('ld-pick-team');
    if (!sel) return;
    const prev = sel.value;
    const teams = (LEAGUE_DATA.teams || Object.keys(LEAGUE_DATA.rosters || {})).slice().sort();
    sel.innerHTML = '<option value="">— Select team on the clock —</option>' +
      teams.map(t => {
        const b = LEAGUE_DATA.budgets && LEAGUE_DATA.budgets[t];
        const roster  = LEAGUE_DATA.rosters[t] || [];
        const kept    = b ? parseInt(b.totalKept)   || 0 : 0;
        const players = b ? parseInt(b.playerCount) || roster.filter(r => r.val2026 !== 'TBD').length : roster.filter(r => r.val2026 !== 'TBD').length;
        const maxed   = players >= 16 || kept >= 200;
        const label   = maxed
          ? `${t} — FULL (${players} players / $${kept})`
          : t;
        return `<option value="${escHtml(t)}"${maxed ? ' disabled' : ''}>${escHtml(label)}</option>`;
      }).join('');
    // Restore previous selection if it's still valid
    if (prev && [...sel.options].some(o => o.value === prev && !o.disabled)) {
      sel.value = prev;
    }
  }

  /* ── Commissioner draft controls ─────────────────────────────────────────── */
  function wireDraftControls() {
    const submitBtn = document.getElementById('ld-submit-pick');
    if (!submitBtn || submitBtn._wired) return;
    submitBtn._wired = true;

    // ── Auto-detect position from the selected player ─────────────────────────
    const playerInp = document.getElementById('ld-pick-player');
    const posSel    = document.getElementById('ld-pick-pos');
    if (playerInp && posSel && !playerInp._posWired) {
      playerInp._posWired = true;
      const autoPos = () => { const p = posForPlayer(playerInp.value.trim()); if (p) posSel.value = p; };
      playerInp.addEventListener('input', autoPos);
      playerInp.addEventListener('change', autoPos);
    }

    document.getElementById('ld-submit-pick').addEventListener('click', async () => {
      const team   = document.getElementById('ld-pick-team').value;
      const player = document.getElementById('ld-pick-player').value.trim();
      // Position auto-detected from the player; dropdown is just a fallback/override.
      const pos    = posForPlayer(player) || document.getElementById('ld-pick-pos').value;
      const bid    = parseInt(document.getElementById('ld-pick-bid').value);
      if (!team)            { alert('Please select a team.'); return; }
      if (!player)          { alert('Please enter a player name.'); return; }
      if (!pos)             { alert('Could not detect a position for this player — pick the position from the dropdown.'); return; }
      if (!bid || bid < 1)  { alert('Please enter an auction value ($1 or more).'); return; }
      // Block maxed-out teams and bids that would breach the $200 cap / 16-player limit
      const _tb = LEAGUE_DATA.budgets && LEAGUE_DATA.budgets[team];
      const _tr = LEAGUE_DATA.rosters && LEAGUE_DATA.rosters[team] || [];
      const _tkept    = _tb ? parseInt(_tb.totalKept)   || 0 : 0;
      const _tplayers = _tb ? parseInt(_tb.playerCount) || _tr.filter(r => r.val2026 !== 'TBD').length : _tr.filter(r => r.val2026 !== 'TBD').length;
      if (_tplayers >= 16) { alert(`${team} already has ${_tplayers} players (max 16). Pick a different team.`); return; }
      if (_tkept >= 200)   { alert(`${team} is at or over the $200 budget (currently $${_tkept}). Pick a different team.`); return; }
      if (_tkept + bid > 200) { alert(`${team} only has $${200 - _tkept} left — a $${bid} bid would put them over the $200 cap.`); return; }
      const btn = document.getElementById('ld-submit-pick');
      btn.disabled = true; btn.textContent = 'Submitting…';
      try {
        const picksRef = window._fbDb.ref('live_draft/picks');
        const newPick  = { team, player, pos, bid, pickNum: _allPicks.length + 1, ts: Date.now() };
        await picksRef.push(newPick);
        // listener handles roster rebuild + Firebase push
        document.getElementById('ld-pick-team').value   = '';
        document.getElementById('ld-pick-player').value = '';
        document.getElementById('ld-pick-bid').value    = '';
      } catch(e) { alert('Failed to submit pick: ' + e.message); }
      btn.disabled = false; btn.textContent = '✅ Submit Pick';
    });

    document.getElementById('ld-finalize-draft').addEventListener('click', async () => {
      if (_allPicks.length === 0) { alert('No picks to finalize — the draft board is empty.'); return; }
      if (!confirm(
        `Finalize this draft?\n\n` +
        `• All ${_allPicks.length} picks will be permanently saved to rosters\n` +
        `• The draft board will be cleared so a new draft can begin\n\n` +
        `This cannot be undone.`
      )) return;

      const btn = document.getElementById('ld-finalize-draft');
      btn.disabled = true; btn.textContent = 'Saving…';

      try {
        // Drop any leftover TBD (undrafted Restricted FA) placeholders — they were
        // released into the pool but never drafted, so they shouldn't stay on rosters.
        let _tbdRemoved = 0;
        for (const t of Object.keys(LEAGUE_DATA.rosters || {})) {
          const before = (LEAGUE_DATA.rosters[t] || []).length;
          LEAGUE_DATA.rosters[t] = (LEAGUE_DATA.rosters[t] || []).filter(r => String(r.val2026) !== 'TBD');
          _tbdRemoved += before - LEAGUE_DATA.rosters[t].length;
        }
        // Recompute budgets after the TBD purge so totals stay accurate.
        for (const team of Object.keys(LEAGUE_DATA.budgets || {})) {
          const b      = LEAGUE_DATA.budgets[team];
          const roster = LEAGUE_DATA.rosters[team] || [];
          const totalKept = roster.reduce((s, r) => s + (parseInt(r.val2026) || 0), 0);
          const budget    = parseInt(b.budget) || 200;
          b.totalKept   = String(totalKept);
          b.playerCount = String(roster.filter(r => r.val2026 !== 'TBD').length);
          b.remaining   = String(budget - totalKept);
          b.inSeasonFaab = String(budget - totalKept + 25);
        }

        // Push updated rosters/budgets to Firebase for live viewers
        const _ts = Date.now();
        window.fbSet && window.fbSet('league_data/leagueData', JSON.stringify(LEAGUE_DATA));
        window.fbSet && window.fbSet('league_data/rosters',  LEAGUE_DATA.rosters);
        window.fbSet && window.fbSet('league_data/budgets',  LEAGUE_DATA.budgets);
        window.fbSet && window.fbSet('league_data/_version', _ts);

        // Commit rosters permanently to GitHub (updates the HTML file)
        const ok = await window.commSave.saveData(
          'LEAGUE_DATA', LEAGUE_DATA,
          `Commissioner: finalize draft — ${_allPicks.length} picks baked into rosters`
        );

        if (!ok) {
          btn.disabled = false; btn.textContent = '📋 Finalize Draft';
          return; // commSave already showed an error toast
        }

        // Update base snapshots FIRST — so when the picks.remove() listener fires
        // and calls rebuildRostersFromPicks([]), it rebuilds from the finalized state
        window._ldBaseRosters = JSON.parse(JSON.stringify(LEAGUE_DATA.rosters));
        window._ldBaseBudgets  = JSON.parse(JSON.stringify(LEAGUE_DATA.budgets));

        // Now clear the live draft board — the listener will rebuild cleanly from the new base
        await window._fbDb.ref('live_draft/picks').remove();

        btn.disabled = false; btn.textContent = '📋 Finalize Draft';
        window.commSave.showToast(`✓ Draft finalized — rosters saved, board cleared${_tbdRemoved ? `, ${_tbdRemoved} undrafted TBD removed` : ''}`);
      } catch(e) {
        alert('Failed to finalize draft: ' + e.message);
        btn.disabled = false; btn.textContent = '📋 Finalize Draft';
      }
    });

    document.getElementById('ld-reset-draft').addEventListener('click', async () => {
      if (!confirm('Reset the entire draft board? This cannot be undone.')) return;
      try {
        await window._fbDb.ref('live_draft/picks').remove();
      } catch(e) { alert('Failed to reset: ' + e.message); }
    });
  }

  /* ── Refresh the board's base rosters/budgets after a commissioner action ──
     (e.g. releasing non-keepers). The board renders from a one-time snapshot
     captured at init, so without re-capturing it would keep showing the old
     (full) rosters until a hard reload. */
  window.refreshLiveDraftBase = function refreshLiveDraftBase() {
    // Only re-snapshot the pre-draft base when the auction hasn't started. Once
    // picks exist the base must stay fixed, or rebuildRostersFromPicks would
    // layer the already-baked picks on top of themselves (double-counting).
    if (!_allPicks || _allPicks.length === 0) {
      window._ldBaseRosters = JSON.parse(JSON.stringify(LEAGUE_DATA.rosters || {}));
      window._ldBaseBudgets  = JSON.parse(JSON.stringify(LEAGUE_DATA.budgets  || {}));
    }
    try { rebuildRostersFromPicks(_allPicks || []); } catch(e){}
    try { renderBoard(_allPicks || []); } catch(e){}
    try { renderTeamPanels(); } catch(e){}
    try { updateTeamDropdown(); } catch(e){}
    try { updatePlayerDropdown(); } catch(e){}
    try { renderTopAvailable(); } catch(e){}
    try { renderNominationStrip(); } catch(e){}
  };

  /* ── Init on page load ───────────────────────────────────────────────────── */
  function init() {
    setupLiveDraftUI();
    // Wire up page hook
    const _origShowPage = window.showPage;
    window.showPage = function(pageId) {
      _origShowPage(pageId);
      // Hide live draft page when navigating away (it's outside the static pages NodeList)
      const ldPage = document.getElementById('page-livedraft');
      const ldBtn  = document.querySelector('.nav-btn[data-page="livedraft"]');
      if (ldPage) ldPage.classList.remove('active');
      if (ldBtn)  ldBtn.classList.remove('active');
    };
  }

  // Start polling for data changes on DOMContentLoaded (no SDK needed)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); initDataSync(); });
  } else { init(); initDataSync(); }
})();
// ===== END PHASE 4 =====


// ===== PHASE 5: POLISH =====
(function() {
  /* ── 1. Save confirmation overlay ─────────────────────────────────────── */
  // Patch commSave.saveData to show a nicer in-page toast with duration
  // Register patcher to be called once commSave is available (set in commInit)
  window._applySaveOverlayPatch = function() {
    if (!window.commSave || window.commSave._overlayPatched) return;
    const _origSave = window.commSave.saveData;
    window.commSave.saveData = async function(varName, newData, message) {
      showSaveOverlay('Saving to GitHub…');
      const result = await _origSave(varName, newData, message);
      // Show the ACTUAL reason on failure instead of always guessing "check your
      // token" — that was actively wrong for cases like "no changes to save" or
      // "save cancelled", which have nothing to do with auth and previously showed
      // up alongside a correct, more specific toast that just contradicted this.
      const reason = window.commSave.getLastError && window.commSave.getLastError();
      hideSaveOverlay(result, reason);
      return result;
    };
    window.commSave._overlayPatched = true;
  };
  // Try immediately in case commSave is somehow already set
  if (window.commSave) window._applySaveOverlayPatch();

  let _saveOverlayEl = null;
  function showSaveOverlay(msg) {
    if (!_saveOverlayEl) {
      _saveOverlayEl = document.createElement('div');
      _saveOverlayEl.id = 'comm-save-overlay';
      document.body.appendChild(_saveOverlayEl);
    }
    _saveOverlayEl.className = 'comm-save-overlay visible saving';
    _saveOverlayEl.textContent = '⏳ ' + msg;
  }
  function hideSaveOverlay(success, reason) {
    if (!_saveOverlayEl) return;
    _saveOverlayEl.className = 'comm-save-overlay visible ' + (success ? 'success' : 'error');
    _saveOverlayEl.textContent = success ? '✅ Saved to GitHub' : '❌ ' + (reason || 'Save failed — check your token');
    setTimeout(() => {
      if (_saveOverlayEl) _saveOverlayEl.className = 'comm-save-overlay';
    }, 3000);
  }

  /* ── 2. Active toolbar button tracks current page ──────────────────────── */
  // Already happens on click; also sync on page load restore
  function syncToolbarActive() {
    const activePage = document.querySelector('.nav-btn.active')?.dataset?.page;
    if (!activePage) return;
    document.querySelectorAll('[data-comm-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.commTool === activePage);
    });
  }
  document.addEventListener('DOMContentLoaded', syncToolbarActive);

  /* ── 3. Unsaved-changes guard ───────────────────────────────────────────── */
  // Warn before navigating away from an editor with unsaved changes
  let _dirty = false;
  document.addEventListener('input', e => {
    if (e.target.closest('.re-input, .wu-textarea, .te-received')) _dirty = true;
  });
  // Reset dirty flag on successful save (detected via save overlay success)
  const _mo = new MutationObserver(() => {
    if (_saveOverlayEl && _saveOverlayEl.classList.contains('success')) _dirty = false;
  });
  if (document.body) _mo.observe(document.body, { childList:true, subtree:true });

  window.addEventListener('beforeunload', e => {
    if (_dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ── 4. Editor bar shows on page re-visit (if comm still unlocked) ─────── */
  // When user clicks a page nav while comm is unlocked, re-inject edit bars
  // This is already handled by the Phase 3 showPage patch; this just ensures
  // the bar doesn't double-inject if it already exists (guard is in inject fns).
})();
// ===== END PHASE 5 =====

// ===== END ROSTER EDITOR =====

// ===== COMMISSIONER MODE =====
(function() {
  // Defer all DOM-dependent init until the full document is parsed
  function commInit() {
  const COMM_HASH  = '80f5c72672e33d781489476f986c83bfe59255f86ed499cb66b4479bfc986b19';
  const COMM_EMAIL = 'commissioner@msuffl.com'; // must match the account created in Firebase console

  async function sha256(msg) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  const isUnlocked = () => sessionStorage.getItem('comm_unlocked') === '1';
  const getToken   = () => sessionStorage.getItem('comm_token') || '';

  function openModal(id)  { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  function showToolbar() {
    document.getElementById('comm-toolbar').classList.add('visible');
    const btn = document.getElementById('comm-lock-btn');
    btn.textContent = '🔓'; btn.classList.add('unlocked');
    btn.title = 'Commissioner mode active — click to logout';
  }
  function hideToolbar() {
    document.getElementById('comm-toolbar').classList.remove('visible');
    const btn = document.getElementById('comm-lock-btn');
    btn.textContent = '🔒'; btn.classList.remove('unlocked');
    btn.title = 'Commissioner login';
  }
  function logout() {
    sessionStorage.removeItem('comm_unlocked');
    sessionStorage.removeItem('comm_token');
    hideToolbar();
    if (window._fbApp && typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signOut().catch(() => {});
    }
  }

  // Lock button
  document.getElementById('comm-lock-btn').addEventListener('click', () => {
    if (isUnlocked()) { logout(); return; }
    openModal('comm-login-overlay');
    setTimeout(() => document.getElementById('comm-password-input').focus(), 60);
  });

  // Close login modal on overlay click or X
  document.getElementById('comm-login-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('comm-login-overlay');
  });
  document.getElementById('comm-modal-close').addEventListener('click', () => closeModal('comm-login-overlay'));

  // Login — enter key
  document.getElementById('comm-password-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('comm-login-btn').click();
  });

  // Login button
  document.getElementById('comm-login-btn').addEventListener('click', async () => {
    const pw = document.getElementById('comm-password-input').value;
    const hash = await sha256(pw);
    const errEl = document.getElementById('comm-login-error');
    if (hash === COMM_HASH) {
      errEl.style.display = 'none';
      // Sign in to Firebase Auth — REQUIRED for live writes now that database
      // rules reject unauthenticated writes to league_data / live_draft / backups.
      if (window._fbApp && typeof firebase !== 'undefined' && firebase.auth) {
        try {
          await firebase.auth().signInWithEmailAndPassword(COMM_EMAIL, pw);
        } catch(e) {
          console.warn('Firebase Auth sign-in failed:', e.message);
          alert('⚠️ Firebase sign-in failed: ' + e.message +
            '\n\nGitHub saves will still work, but LIVE updates (draft board, roster edits, keeper tools) will be rejected by the database.' +
            '\n\nFix: in the Firebase console → Authentication, make sure the user ' + COMM_EMAIL + ' exists and its password matches the commissioner password.');
        }
      }
      document.getElementById('comm-password-input').value = '';
      closeModal('comm-login-overlay');
      sessionStorage.setItem('comm_unlocked', '1');
      // Ask for GitHub token
      openModal('comm-token-overlay');
      setTimeout(() => document.getElementById('comm-token-input').focus(), 60);
    } else {
      errEl.style.display = 'block';
      document.getElementById('comm-password-input').select();
    }
  });

  // Token — enter key
  document.getElementById('comm-token-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('comm-token-btn').click();
  });

  // Token button
  document.getElementById('comm-token-btn').addEventListener('click', () => {
    const token = document.getElementById('comm-token-input').value.trim();
    if (!token) return;
    sessionStorage.setItem('comm_token', token);
    document.getElementById('comm-token-input').value = '';
    closeModal('comm-token-overlay');
    showToolbar();
  });

  // Logout
  document.getElementById('comm-logout-btn').addEventListener('click', logout);

  // Toolbar tool buttons — navigate to the right page
  document.querySelectorAll('[data-comm-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.commTool;
      const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
      if (navBtn) navBtn.click();
      document.querySelectorAll('[data-comm-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Restore session on page load
  if (isUnlocked() && getToken()) showToolbar();

  // Expose API for Phase 3+ editors
  // Apply Phase 5 save overlay patch now that commSave is defined
  if (window._applySaveOverlayPatch) window._applySaveOverlayPatch();
  window.commMode = { isUnlocked, getToken, showToolbar, hideToolbar };
  } // end commInit

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', commInit);
  } else {
    commInit(); // DOM already ready
  }
})();
// ===== END COMMISSIONER MODE =====
