const fs = require("fs");
const { chromium } = require("playwright");

const PLAYLIST_URL = "https://www.youtube.com/playlist?list=YOUR_ID";
const ORDER_FILE = "./playlist.json";
const PROGRESS_FILE = "./progress.json";

// ---------------- LOAD ----------------
function loadOrder() {
  return JSON.parse(fs.readFileSync(ORDER_FILE, "utf-8"));
}

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return { done: {} };
  return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
}

function saveProgress(p) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ---------------- DOM STATE ----------------
async function getOrder(page) {
  return await page.evaluate(() => {
    return [...document.querySelectorAll("ytd-playlist-video-renderer")]
      .map((el) => {
        const a = el.querySelector("a#video-title");
        const href = a?.href || "";
        const match = href.match(/v=([^&]+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
  });
}

// ---------------- LOCATE ROW ----------------
async function getRow(page, vid) {
  return page
    .locator("ytd-playlist-video-renderer")
    .filter({
      has: page.locator(`a[href*="v=${vid}"]`),
    })
    .first();
}

const HANDLE = "#index-container";

// ---------------- SAFE DRAG ----------------
// Scrolls source into view, activates drag, then scrolls destination into view
// while holding the mouse button, and releases. O(1) per video regardless of distance.
async function drag(page, fromRow, toRow) {
  const handle = fromRow.locator(HANDLE);
  await fromRow.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  const src = await handle.boundingBox();
  if (!src) throw new Error("no src box");

  const sx = src.x + src.width / 2;
  const sy = src.y + src.height / 2;

  await page.mouse.move(sx, sy);
  await page.waitForTimeout(300);
  await page.mouse.down();
  await page.waitForTimeout(200);
  // small nudge to activate drag mode
  await page.mouse.move(sx, sy + 5, { steps: 3 });
  await page.waitForTimeout(200);

  // scroll destination into view while drag is active, then move and release
  await toRow.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  const dst = await toRow.boundingBox();
  if (!dst) throw new Error("no dst box");

  await page.mouse.move(dst.x + 20, dst.y + dst.height / 2, { steps: 20 });
  await page.waitForTimeout(100);
  await page.mouse.up();
}

// ---------------- MOVE UNTIL CORRECT ----------------
async function moveToIndex(page, vid, targetIndex) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const order = await getOrder(page);
    const currentIndex = order.indexOf(vid);

    if (currentIndex === -1) return false;
    if (currentIndex === targetIndex) return true;

    const rows = page.locator("ytd-playlist-video-renderer");
    const from = rows.nth(currentIndex);
    const to = rows.nth(targetIndex);

    try {
      await drag(page, from, to);
    } catch {}

    await page.waitForTimeout(600);

    const after = await getOrder(page);
    if (after[targetIndex] === vid) return true;
  }

  return false;
}

// ---------------- MAIN ----------------
(async () => {
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const context = browser.contexts()[0];

  const page = context
    .pages()
    .find((p) => p.url().includes("youtube.com/playlist"));

  if (!page) throw new Error("Open playlist tab first");

  const order = loadOrder();
  const progress = loadProgress();

  console.log("Starting...");

  for (let i = 0; i < order.length; i++) {
    const vid = order[i].id;

    // skip already confirmed
    if (progress.done[vid]) {
      console.log(`[${i}] skip (done) ${vid}`);
      continue;
    }

    const ok = await moveToIndex(page, vid, i);

    if (ok) {
      console.log(`[${i}] OK ${vid}`);
      progress.done[vid] = true;
    } else {
      console.log(`[${i}] FAIL ${vid}`);
    }

    saveProgress(progress);
    await page.waitForTimeout(300);
  }

  console.log("DONE");
  process.exit(0);
})();
