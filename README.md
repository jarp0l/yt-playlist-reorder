# yt-playlist-reorder

Reorders a YouTube playlist via Playwright drag-and-drop to match a desired order defined in `playlist.json`.

## Setup

```bash
pnpm install
```

## Usage

### 1. Export your playlist to `playlist.json`

Open your YouTube playlist, open DevTools console, and run:

```js
const data = [...document.querySelectorAll('ytd-playlist-video-renderer')]
  .map(el => {
    const a = el.querySelector('#video-title');
    const title = a?.textContent.trim();
    const href = a?.href || '';
    const id = new URL(href).searchParams.get('v');
    return { title, id };
  });

copy(JSON.stringify(data, null, 2));
```

This copies the list to your clipboard. Paste it into `playlist.json`.

**Format:**

```json
[
  { "title": "Video title", "id": "VIDEO_ID" },
  { "id": "VIDEO_ID_NO_TITLE" }
]
```

`title` is optional — only `id` is used for reordering. Reorder the entries in `playlist.json` however you like before running the script.

### 2. Open the browser with remote debugging enabled

```bash
/Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/brave-debug
```

Log in to YouTube and open your playlist tab. Keep it open.

### 3. Run

```bash
pnpm start
```

The script connects to the open playlist tab and drags videos into the order specified in `playlist.json`. Progress is saved to `progress.json` after each video, so you can safely interrupt and resume.
