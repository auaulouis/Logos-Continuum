# Logos Web (Offline Fork)

## What this is

This project is an offline/local fork of [tvergho/logos-web](https://github.com/tvergho/logos-web).

- Original project: **Logos Web by tvergho**
- This fork adapts the stack to run fully offline on your machine (no AWS required)
- Frontend: Next.js app in `logos-web`
- Backend: local parser/search API in `verbatim-parser `

## Prerequisites

- macOS/Linux shell
- Node.js (recommended: current LTS)
- Python 3.9+

## Install

### 1) Backend install

```bash
cd "../verbatim-parser "
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Frontend install

```bash
cd "../logos-web"
yarn install
```

If you do not use Yarn:

```bash
npm install
```

## Run everything

From the workspace root (`Logos backup`), start backend + frontend together:

```bash
./start.sh
```

Then open:

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:5001](http://localhost:5001)

## Run services manually (optional)

### Backend only

```bash
cd "../verbatim-parser "
source .venv/bin/activate
PORT=5001 python3 api.py
```

### Frontend only

```bash
cd "../logos-web"
yarn dev
```

## Parser & scraper commands (updated)

Run these from `verbatim-parser ` with your virtualenv active.

### Parse all local docs

Parses every `.docx` under `local_docs` and writes to the local index.
File-level parallel parsing is enabled by default.
After each successful batch flush, parsed files are moved into `local_docs/done`, so reruns only parse new files.

```bash
cd "../verbatim-parser "
source .venv/bin/activate
python3 local_parser.py
```

### Parse with speed + profiling

```bash
PARSER_PROFILE=1 PARSER_CARD_WORKERS=4 python3 local_parser.py
```

### Progress / ordering controls

```bash
# Print progress every 50 files
LOCAL_PARSER_PROGRESS_EVERY=50 python3 local_parser.py

# Set file-level parallel workers (default: min(cpu_count, 8))
LOCAL_PARSER_FILE_WORKERS=8 python3 local_parser.py

# Flush writes every 100 parsed docs (batch append)
LOCAL_PARSER_FLUSH_EVERY=100 python3 local_parser.py

# Sort docs before parsing
LOCAL_PARSER_SORT=size_asc  python3 local_parser.py   # default
LOCAL_PARSER_SORT=size_desc python3 local_parser.py
LOCAL_PARSER_SORT=name      python3 local_parser.py
```

### Scraper batch run

`scraper.py` uses its hardcoded source/config (division/year/url) in the file's `__main__` block.

```bash
cd "../verbatim-parser "
source .venv/bin/activate
PARSER_PROFILE=1 PARSER_CARD_WORKERS=4 python3 scraper.py
```

If `PARSER_CARD_WORKERS` is not set, parser workers default to `min(4, cpu_count)`.

## Local data/index behavior

- On first startup, the backend parses `.docx` files in `verbatim-parser /local_docs`
- Parsed cards are written to a local JSON index at `verbatim-parser /local_docs/cards_index.json`
- The frontend points to `http://localhost:5001` in development

## What `wipe.py` does

`wipe.py` clears the local card index file used by the backend search layer.

Run it from `verbatim-parser `:

```bash
source .venv/bin/activate
python3 wipe.py
```

After running it, the index is empty; the next backend startup will rebuild from files in `local_docs`.

## Credits

Based on [tvergho/logos-web](https://github.com/tvergho/logos-web), adapted here for offline/local use.

## License

MIT