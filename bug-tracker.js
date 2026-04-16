// bug-tracker.js — Minimal in-game bug reporting and tracking system
// Usage: BugTracker.report('description', { context: ... })
//        BugTracker.showPanel() to view all bugs
//        BugTracker.getAll() for programmatic access

const BugTracker = (function() {
  let bugs = [];
  // Load from localStorage if present
  try {
    const saved = localStorage.getItem('ok_bugtracker');
    if (saved) bugs = JSON.parse(saved);
  } catch(e) {}

  function save() {
    try { localStorage.setItem('ok_bugtracker', JSON.stringify(bugs)); } catch(e) {}
  }

  function report(description, context) {
    const bug = {
      id: Date.now() + '-' + Math.floor(Math.random()*10000),
      description,
      context: context || {},
      time: new Date().toISOString(),
      status: 'open',
      userAgent: navigator.userAgent,
      url: location.href
    };
    bugs.push(bug);
    save();
    renderPanel();
    return bug.id;
  }

  function close(id) {
    const bug = bugs.find(b => b.id === id);
    if (bug) { bug.status = 'closed'; save(); renderPanel(); }
  }

  function getAll() { return bugs.slice(); }

  // Minimal UI panel
  let panel = null;
  function renderPanel() {
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'bug-tracker-panel';
      panel.style.cssText = 'position:fixed;top:10%;right:10px;width:340px;max-height:70vh;overflow:auto;z-index:99999;background:rgba(0,0,0,0.95);color:#fff;border:2px solid #ff4444;border-radius:8px;padding:12px;font-family:monospace;font-size:13px;display:none;';
      document.body.appendChild(panel);
    }
    let html = '<h3 style="color:#ff4444;margin:0 0 8px 0">🐞 Bug Tracker</h3>';
    if (bugs.length === 0) html += '<div style="color:#aaa">No bugs reported.</div>';
    for (const bug of bugs) {
      html += `<div style="margin-bottom:10px;border-bottom:1px solid #333;padding-bottom:6px">
        <b style="color:${bug.status==='open'?'#ff4444':'#44ff88'}">${bug.status.toUpperCase()}</b> — <span style="color:#aaa">${bug.time}</span><br>
        <span>${bug.description.replace(/</g,'&lt;')}</span><br>
        <span style="color:#888">${bug.url}</span><br>
        <button onclick="BugTracker.close('${bug.id}')" style="margin-top:2px;font-size:11px;padding:2px 8px;border-radius:4px;border:none;background:#222;color:#fff;cursor:pointer">Close</button>
      </div>`;
    }
    html += '<button onclick="BugTracker.hidePanel()" style="margin-top:8px;font-size:12px;padding:4px 16px;border-radius:4px;border:none;background:#ff4444;color:#fff;cursor:pointer">Close Panel</button>';
    panel.innerHTML = html;
  }

  function showPanel() {
    renderPanel();
    if (panel) panel.style.display = 'block';
  }
  function hidePanel() {
    if (panel) panel.style.display = 'none';
  }

  // Add a floating button for quick bug reporting
  if (!document.getElementById('bug-report-btn')) {
    const btn = document.createElement('button');
    btn.id = 'bug-report-btn';
    btn.textContent = '🐞 Report Bug';
    btn.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:99999;background:#ff4444;color:#fff;font-size:15px;padding:8px 18px;border:none;border-radius:6px;box-shadow:0 2px 8px #0008;cursor:pointer;';
    btn.onclick = function() {
      const desc = prompt('Describe the bug you encountered:');
      if (desc) report(desc, {});
      showPanel();
    };
    document.body.appendChild(btn);
  }

  // Expose API
  return {
    report, close, getAll, showPanel, hidePanel
  };
})();

window.BugTracker = BugTracker;
