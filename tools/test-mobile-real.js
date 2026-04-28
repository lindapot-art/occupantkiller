/**
 * Real mobile play test — emulates touch-only iPhone landscape and tries to
 * actually pass the start screen by TAPPING #start-btn (no forceStartGame bypass).
 * Then audits every overlay menu for off-screen / hidden / non-tappable elements.
 *
 * Usage: node tools/test-mobile-real.js [url]
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SHOT = path.join(__dirname, 'screenshots', 'mobile-real');
if (!fs.existsSync(SHOT)) fs.mkdirSync(SHOT, { recursive: true });

// Each scenario tests both new-player (no localStorage) and returning-player
// (ok_has_played set so the advanced start section with #start-btn is visible).
const VIEWPORTS = [
  { name: 'iphone-landscape-new',       w: 844, h: 390, returning: false },
  { name: 'iphone-landscape-returning', w: 844, h: 390, returning: true  },
  { name: 'small-android-new',          w: 720, h: 360, returning: false },
  { name: 'small-android-returning',    w: 720, h: 360, returning: true  },
];

(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--touch-events=enabled'],
  });
  const fails = [];
  const warns = [];

  for (const vp of VIEWPORTS) {
    console.log('\n=== ' + vp.name + ' (' + vp.w + 'x' + vp.h + ') ===');
    // Use a fresh incognito context so localStorage is isolated per scenario
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.emulate({
      viewport: { width: vp.w, height: vp.h, isMobile: true, hasTouch: true, isLandscape: true, deviceScaleFactor: 2 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const errs = [];
    page.on('pageerror', e => errs.push('CRASH: ' + e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const t = m.text();
      // Backend on :3001 is optional in offline play; ignore connection refused noise.
      if (/ERR_CONNECTION_REFUSED|Failed to fetch|net::ERR_/.test(t)) return;
      errs.push('console: ' + t);
    });

    if (vp.returning) {
      await page.evaluateOnNewDocument(() => {
        try { localStorage.setItem('ok_has_played', '1'); } catch (_) {}
      });
    } else {
      await page.evaluateOnNewDocument(() => {
        try { localStorage.removeItem('ok_has_played'); } catch (_) {}
      });
    }
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction(() => typeof window.GameManager !== 'undefined', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));

    // === Audit start screen ===
    // Pick the user-facing primary CTA: quick-start for new players, start-btn for returning.
    const targetBtnId = vp.returning ? 'start-btn' : 'quick-start-btn';
    const startAudit = await page.evaluate((W, H, btnId) => {
      const overlay = document.getElementById('overlay-start');
      const cs = window.getComputedStyle(overlay);
      const r = overlay.getBoundingClientRect();
      const startBtn = document.getElementById(btnId);
      const sb = startBtn ? startBtn.getBoundingClientRect() : null;
      const sbCs = startBtn ? window.getComputedStyle(startBtn) : null;
      const hasSize = sb && sb.width > 0 && sb.height > 0;
      const btnInView = hasSize && sb.top >= 0 && sb.bottom <= H && sb.left >= 0 && sb.right <= W;
      const scrollableY = overlay.scrollHeight > overlay.clientHeight;
      const scrollableTo = hasSize && sb.bottom + overlay.scrollTop <= overlay.scrollHeight;
      // Audit ALL VISIBLE buttons in the overlay for off-screen X-axis
      const buttons = Array.from(overlay.querySelectorAll('button, .btn'));
      const offScreenBtns = [];
      const zeroSizeBtns = [];
      for (const b of buttons) {
        if (b.offsetParent === null) continue; // truly hidden
        const br = b.getBoundingClientRect();
        if (br.width === 0 || br.height === 0) {
          zeroSizeBtns.push(b.id || b.textContent.trim().slice(0, 24));
          continue;
        }
        if (br.right > W + 2 || br.left < -2) {
          offScreenBtns.push({ id: b.id || b.textContent.trim().slice(0, 30), x: Math.round(br.x), w: Math.round(br.width), right: Math.round(br.right) });
        }
      }
      return {
        overlayDisplay: cs.display,
        overlayBox: { w: Math.round(r.width), h: Math.round(r.height) },
        viewportH: H,
        scrollHeight: overlay.scrollHeight,
        clientHeight: overlay.clientHeight,
        scrollableY,
        targetBtnId: btnId,
        startBtn: sb ? {
          top: Math.round(sb.top), bottom: Math.round(sb.bottom),
          left: Math.round(sb.left), right: Math.round(sb.right),
          w: Math.round(sb.width), h: Math.round(sb.height),
          cssDisplay: sbCs.display,
          cssVisibility: sbCs.visibility,
          hasSize,
          inView: btnInView,
          scrollableTo,
        } : null,
        offScreenBtns,
        zeroSizeBtns,
      };
    }, vp.w, vp.h, targetBtnId);
    console.log('  start-screen audit:', JSON.stringify(startAudit, null, 2));
    await page.screenshot({ path: path.join(SHOT, vp.name + '-01-start.png') });

    if (!startAudit.startBtn) {
      fails.push(vp.name + ': #' + targetBtnId + ' missing');
      await page.close(); continue;
    }
    if (!startAudit.startBtn.hasSize) {
      fails.push(vp.name + ': #' + targetBtnId + ' has zero size (' + startAudit.startBtn.w + 'x' + startAudit.startBtn.h + ', display=' + startAudit.startBtn.cssDisplay + ') — invisible to mobile users');
      await page.close(); continue;
    }
    if (startAudit.zeroSizeBtns.length > 0) {
      warns.push(vp.name + ': zero-size visible buttons: ' + startAudit.zeroSizeBtns.join(', '));
    }
    if (startAudit.offScreenBtns.length > 0) {
      fails.push(vp.name + ': start-screen buttons off-screen X-axis: ' + JSON.stringify(startAudit.offScreenBtns));
    }

    // Scroll into view first if needed (mobile users would have to)
    if (!startAudit.startBtn.inView) {
      warns.push(vp.name + ': #' + targetBtnId + ' not in initial viewport — needs scroll (top=' + startAudit.startBtn.top + ', bottom=' + startAudit.startBtn.bottom + ', viewportH=' + vp.h + ')');
      await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), targetBtnId);
      await new Promise(r => setTimeout(r, 400));
    }

    // Real touch tap via viewport coords (no element-anchored .click() that bypasses geometry)
    const tapInfo = await page.evaluate((id) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width, h: r.height };
    }, targetBtnId);
    const tapped = await page.evaluate((id, cx, cy) => {
      const top = document.elementFromPoint(cx, cy);
      const el = document.getElementById(id);
      const blocked = top !== el && !(el && el.contains(top));
      const blocker = blocked && top ? (top.id || top.tagName + (top.className ? '.' + top.className : '')) : null;
      try {
        const t = new Touch({ identifier: 1, target: top || el, clientX: cx, clientY: cy, radiusX: 10, radiusY: 10, force: 1 });
        const tgt = top || el;
        tgt.dispatchEvent(new TouchEvent('touchstart', { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
        tgt.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [t], bubbles: true, cancelable: true }));
        // synthetic click at coords
        tgt.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
      } catch (_) {}
      return { blocked, blocker, cx, cy, topId: top ? (top.id || top.tagName) : null };
    }, targetBtnId, tapInfo.cx, tapInfo.cy);
    console.log('  start-btn tap:', JSON.stringify(tapped));
    if (tapped.blocked) fails.push(vp.name + ': #' + targetBtnId + ' covered by ' + tapped.blocker + ' at center — tap blocked');

    // Wait for state=playing
    let state = null;
    for (let i = 0; i < 20; i++) {
      state = await page.evaluate(() => window.GameManager && GameManager.getState && GameManager.getState());
      if (state === 'playing' || state === 'preWave') break;
      await new Promise(r => setTimeout(r, 500));
    }
    console.log('  game state after tap:', state);
    if (state !== 'playing' && state !== 'preWave') {
      fails.push(vp.name + ': game did not start after tap, state=' + state);
    }
    await page.screenshot({ path: path.join(SHOT, vp.name + '-02-after-tap.png') });

    // === Audit mobile controls in landscape play ===
    if (state === 'playing' || state === 'preWave') {
      const ctrls = await page.evaluate((W, H) => {
        const ids = ['mobile-controls', 'joystick-zone', 'mobile-look-zone', 'btn-fire', 'btn-jump',
          'btn-crouch', 'btn-melee', 'btn-grenade', 'btn-reload', 'btn-aim', 'btn-pause',
          'btn-weapon-prev', 'btn-weapon-next', 'btn-sprint', 'btn-use', 'btn-vehicle', 'btn-build'];
        const out = {};
        for (const id of ids) {
          const el = document.getElementById(id);
          if (!el) { out[id] = { missing: true }; continue; }
          const r = el.getBoundingClientRect();
          const cs = window.getComputedStyle(el);
          const visible = cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
          const inView = r.right <= W + 1 && r.left >= -1 && r.bottom <= H + 1 && r.top >= -1;
          out[id] = { visible, inView, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        }
        return out;
      }, vp.w, vp.h);
      const offScreenCtrls = [];
      const invisibleCtrls = [];
      for (const k of Object.keys(ctrls)) {
        const v = ctrls[k];
        if (v.missing) continue;
        if (!v.visible) invisibleCtrls.push(k);
        else if (!v.inView) offScreenCtrls.push(k + ' @ (' + v.x + ',' + v.y + ' ' + v.w + 'x' + v.h + ')');
      }
      console.log('  in-game ctrls:', JSON.stringify(ctrls, null, 2));
      if (offScreenCtrls.length) fails.push(vp.name + ': in-game controls off-screen: ' + offScreenCtrls.join(', '));
      if (invisibleCtrls.length) fails.push(vp.name + ': in-game controls invisible: ' + invisibleCtrls.join(', '));

      // === Audit ALL overlays for off-screen / overflow on mobile ===
      // Force each overlay visible one at a time and measure every visible button.
      const overlayIds = ['overlay-pause', 'overlay-drone-select', 'overlay-dead',
        'overlay-waveclear', 'overlay-stageclear', 'overlay-win', 'inventory-overlay'];
      for (const ovId of overlayIds) {
        const audit = await page.evaluate((id, W, H) => {
          const ov = document.getElementById(id);
          if (!ov) return { missing: true };
          // Hide siblings first (the start overlay etc.)
          const allOv = document.querySelectorAll('.overlay');
          const prev = [];
          for (const o of allOv) { prev.push([o, o.style.display]); o.style.display = 'none'; }
          ov.style.display = 'flex';
          // Open inventory tabs/sub-grids if present so all buttons render
          if (id === 'inventory-overlay' && typeof GameManager !== 'undefined') {
            try { GameManager.refreshMarketplaceUI && GameManager.refreshMarketplaceUI('shop'); } catch (_) {}
          }
          const r = ov.getBoundingClientRect();
          const cs = window.getComputedStyle(ov);
          const buttons = Array.from(ov.querySelectorAll('button, .btn, .inv-tab'));
          const offScreenX = [];
          const offScreenY = [];
          let visBtns = 0;
          for (const b of buttons) {
            if (b.offsetParent === null) continue;
            const br = b.getBoundingClientRect();
            if (br.width === 0 || br.height === 0) continue;
            visBtns++;
            if (br.right > W + 2 || br.left < -2) {
              offScreenX.push({ id: b.id || b.textContent.trim().slice(0, 24), x: Math.round(br.x), w: Math.round(br.width), right: Math.round(br.right) });
            }
            // Allow vertical overflow only if the overlay/inner content is scrollable
            const sc = ov.querySelector('.overlay-content') || ov;
            const scrollable = sc.scrollHeight > sc.clientHeight + 4;
            if ((br.bottom > H + 2 || br.top < -2) && !scrollable) {
              offScreenY.push({ id: b.id || b.textContent.trim().slice(0, 24), y: Math.round(br.y), h: Math.round(br.height), bottom: Math.round(br.bottom) });
            }
          }
          // Restore
          for (const [o, d] of prev) o.style.display = d;
          return { display: cs.display, w: Math.round(r.width), h: Math.round(r.height), visBtns, offScreenX, offScreenY };
        }, ovId, vp.w, vp.h);
        if (audit.missing) continue;
        console.log('  ' + ovId + ':', JSON.stringify(audit));
        await page.screenshot({ path: path.join(SHOT, vp.name + '-ov-' + ovId + '.png') });
        // Restore visibility for screenshots — re-show
        await page.evaluate((id) => {
          const o = document.getElementById(id);
          if (o) o.style.display = 'none';
        }, ovId);
        if (audit.offScreenX && audit.offScreenX.length) {
          fails.push(vp.name + ': ' + ovId + ' buttons off-screen X: ' + JSON.stringify(audit.offScreenX.slice(0, 4)));
        }
        if (audit.offScreenY && audit.offScreenY.length) {
          fails.push(vp.name + ': ' + ovId + ' buttons off-screen Y (no scroll): ' + JSON.stringify(audit.offScreenY.slice(0, 4)));
        }
      }

      // Open inventory overlay (TAB)
      await page.evaluate(() => {
        const el = document.getElementById('btn-pause');
        if (el) {
          const r = el.getBoundingClientRect();
          const t = new Touch({ identifier: 7, target: el, clientX: r.x + 10, clientY: r.y + 10 });
          el.dispatchEvent(new TouchEvent('touchstart', { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
          el.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [t], bubbles: true, cancelable: true }));
        } else {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
        }
      });
      await new Promise(r => setTimeout(r, 600));
      await page.screenshot({ path: path.join(SHOT, vp.name + '-03-inventory.png') });

      const inv = await page.evaluate((W, H) => {
        const ov = document.getElementById('inventory-overlay') || document.getElementById('overlay-pause');
        if (!ov) return { missing: true };
        const cs = window.getComputedStyle(ov);
        const r = ov.getBoundingClientRect();
        const buttons = Array.from(ov.querySelectorAll('button, .btn'));
        const offScreen = [];
        for (const b of buttons) {
          if (b.offsetParent === null) continue;
          const br = b.getBoundingClientRect();
          if (br.width === 0 || br.height === 0) continue;
          if (br.right > W + 2 || br.left < -2 || br.bottom > H + 2 || br.top < -2) {
            offScreen.push({ id: b.id || b.textContent.trim().slice(0, 24), x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height) });
          }
        }
        return { display: cs.display, visibility: cs.visibility, w: r.width, h: r.height, offScreen, totalBtns: buttons.length };
      }, vp.w, vp.h);
      console.log('  inventory overlay:', JSON.stringify(inv));
      if (!inv.missing && inv.display !== 'none' && inv.offScreen && inv.offScreen.length) {
        fails.push(vp.name + ': inventory buttons off-screen: ' + JSON.stringify(inv.offScreen.slice(0, 6)));
      }
    }

    if (errs.length) {
      console.log('  JS errors:', errs.slice(0, 5));
      fails.push(vp.name + ': ' + errs.length + ' JS errors (first: ' + errs[0] + ')');
    }
    await page.close();
    await ctx.close();
  }

  await browser.close();
  console.log('\n\n========== SUMMARY ==========');
  if (warns.length) console.log('WARNINGS:\n  ' + warns.join('\n  '));
  if (fails.length) {
    console.log('\nFAILS:\n  ' + fails.join('\n  '));
    process.exit(1);
  }
  console.log('\nPASS — mobile real-touch play works on all tested viewports.');
  process.exit(0);
})();
