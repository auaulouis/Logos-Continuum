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