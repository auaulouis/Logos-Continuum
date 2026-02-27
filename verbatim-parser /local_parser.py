import os
import glob
import time
import subprocess
import json
import traceback
from concurrent.futures import ProcessPoolExecutor, as_completed
from parser import Parser, resolve_card_workers
from search import Search

LOCAL_FOLDER = "./local_docs"
DONE_SUBDIR = "done"
PARSER_SETTINGS_PATH = os.environ.get("PARSER_SETTINGS_PATH", os.path.join(LOCAL_FOLDER, "parser_settings.json"))
PARSER_EVENTS_PATH = os.environ.get("PARSER_EVENTS_PATH", os.path.join(LOCAL_FOLDER, "parser_events.jsonl"))


def _append_parser_event(level, message, payload=None):
    event = {
        "id": f"{int(time.time() * 1000)}-{os.getpid()}-{(time.time_ns() % 1000000)}",
        "at": int(time.time() * 1000),
        "level": str(level),
        "message": str(message),
        "source": "local-parser",
    }
    if isinstance(payload, dict):
        event.update(payload)

    try:
        os.makedirs(os.path.dirname(PARSER_EVENTS_PATH), exist_ok=True)
        with open(PARSER_EVENTS_PATH, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    except OSError:
        pass

    print(f"[parser:{event['level']}] {event['message']}", flush=True)
    return event


def _load_parser_settings():
    try:
        with open(PARSER_SETTINGS_PATH, "r", encoding="utf-8") as handle:
            raw = handle.read().strip()
            if raw == "":
                return {}
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def _coerce_bool(value, fallback):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ("true", "1", "yes", "on"):
            return True
        if normalized in ("false", "0", "no", "off"):
            return False
    if isinstance(value, (int, float)):
        return value != 0
    return fallback


def _is_under_folder(path, folder):
    try:
        path_abs = os.path.abspath(path)
        folder_abs = os.path.abspath(folder)
        return os.path.commonpath([path_abs, folder_abs]) == folder_abs
    except ValueError:
        return False


def _move_to_done(filepath, local_folder, done_folder):
    rel_path = os.path.relpath(filepath, start=local_folder)
    target_path = os.path.join(done_folder, rel_path)
    target_dir = os.path.dirname(target_path)
    os.makedirs(target_dir, exist_ok=True)

    if not os.path.exists(target_path):
        os.replace(filepath, target_path)
        return target_path

    base_name, ext = os.path.splitext(os.path.basename(target_path))
    suffix = 1
    while True:
        candidate = os.path.join(target_dir, f"{base_name}-{suffix}{ext}")
        if not os.path.exists(candidate):
            os.replace(filepath, candidate)
            return candidate
        suffix += 1


def _parse_single_file(filepath, card_workers, profile):
    filename = os.path.basename(filepath)
    started = time.perf_counter()
    parser = Parser(
        filepath,
        {
            "filename": filename,
            "division": "local",
            "year": "local",
            "school": "Local",
            "team": "Local",
            "download_url": "local"
        },
        max_workers=card_workers,
        profile=profile
    )
    cards = parser.parse()
    duration_ms = (time.perf_counter() - started) * 1000
    return {
        "filename": filename,
        "duration_ms": duration_ms,
        "card_indexes": [card.get_index() for card in cards],
    }


def _detect_physical_cores():
    try:
        output = subprocess.check_output(["sysctl", "-n", "hw.physicalcpu"], text=True).strip()
        value = int(output)
        if value > 0:
            return value
    except Exception:
        pass

    logical = os.cpu_count() or 1
    return max(1, logical // 2)

def run_local_parser():
    done_folder = os.path.join(LOCAL_FOLDER, DONE_SUBDIR)

    files = glob.glob(os.path.join(LOCAL_FOLDER, "**/*.docx"), recursive=True)
    files = [
        path for path in files
        if not os.path.basename(path).startswith("~$") and not _is_under_folder(path, done_folder)
    ]
    if not files:
        print(f"⚠️ No new files found in {LOCAL_FOLDER} (excluding {done_folder})")
        _append_parser_event("warn", f"No new files found in {LOCAL_FOLDER}")
        return

    sort_mode = os.environ.get("LOCAL_PARSER_SORT", "size_asc").strip().lower()
    if sort_mode == "size_desc":
        files.sort(key=lambda path: os.path.getsize(path), reverse=True)
    elif sort_mode == "name":
        files.sort(key=lambda path: os.path.basename(path).lower())
    else:
        files.sort(key=lambda path: os.path.getsize(path))

    total_files = len(files)
    print(f"🔎 Found {total_files} files. Starting diagnostic parse... (sort={sort_mode})")
    _append_parser_event("info", f"Local parser started with {total_files} file(s)", {
        "files": total_files,
        "sort_mode": sort_mode,
    })
    run_started = time.perf_counter()
    processed = 0
    failed = 0
    parser_settings = _load_parser_settings()

    progress_every = int(os.environ.get("LOCAL_PARSER_PROGRESS_EVERY", "250"))

    if os.environ.get("LOCAL_PARSER_FLUSH_EVERY") is not None:
        flush_every = max(1, int(os.environ.get("LOCAL_PARSER_FLUSH_EVERY", "250")))
    else:
        flush_every = max(1, int(parser_settings.get("flush_every_docs", 250)))

    flush_enabled = _coerce_bool(parser_settings.get("flush_enabled", True), True)

    use_parallel_processing = _coerce_bool(parser_settings.get("use_parallel_processing", True), True)

    if not use_parallel_processing:
        card_workers = 1
    elif os.environ.get("PARSER_CARD_WORKERS") is not None:
        card_workers = resolve_card_workers()
    else:
        card_workers = max(1, int(parser_settings.get("parser_card_workers", 1)))

    physical_cores = _detect_physical_cores()
    if physical_cores >= 4:
        default_file_workers = min(physical_cores, 8)
    else:
        default_file_workers = physical_cores
    if not use_parallel_processing:
        file_workers = 1
    elif os.environ.get("LOCAL_PARSER_FILE_WORKERS") is not None:
        file_workers = max(1, int(os.environ.get("LOCAL_PARSER_FILE_WORKERS", str(default_file_workers))))
    else:
        file_workers = max(1, int(parser_settings.get("local_parser_file_workers", default_file_workers)))
    profile = os.environ.get("PARSER_PROFILE", "0") == "1"
    verbose_file_logs = os.environ.get("LOCAL_PARSER_VERBOSE_FILE_LOGS", "0") == "1"

    search = Search()
    buffered_card_indexes = []
    buffered_docs = 0
    buffered_cards = 0
    buffered_done_paths = []

    print(f"⚙️  Write flush interval: every {flush_every} docs")
    print(f"⚙️  Flush enabled: {flush_enabled}")
    print(f"⚙️  Card workers per doc: {card_workers}")
    print(f"⚙️  File workers: {file_workers} (physical_cores={physical_cores})")
    print(f"⚙️  Done folder: {done_folder}")

    def flush_buffer(reason):
        nonlocal buffered_card_indexes, buffered_docs, buffered_cards, buffered_done_paths
        if len(buffered_done_paths) == 0:
            return

        search.upload_card_indexes(buffered_card_indexes, force_upload=True)
        moved = 0
        for path in buffered_done_paths:
            if os.path.exists(path):
                _move_to_done(path, LOCAL_FOLDER, done_folder)
                moved += 1
        print(f"💾 Flushed {buffered_cards} cards from {buffered_docs} docs ({reason})")
        print(f"📦 Moved {moved} files to done folder")
        buffered_card_indexes = []
        buffered_docs = 0
        buffered_cards = 0
        buffered_done_paths = []

    with ProcessPoolExecutor(max_workers=file_workers) as executor:
        future_map = {
            executor.submit(_parse_single_file, filepath, card_workers, profile): filepath
            for filepath in files
        }

        for index, future in enumerate(as_completed(future_map), start=1):
            filepath = future_map[future]
            filename = os.path.basename(filepath)

            try:
                result = future.result()
                card_indexes = result["card_indexes"]
                buffered_card_indexes.extend(card_indexes)
                buffered_docs += 1
                buffered_cards += len(card_indexes)
                buffered_done_paths.append(filepath)

                if flush_enabled and buffered_docs >= flush_every:
                    flush_buffer(f"interval={flush_every}")

                if verbose_file_logs:
                    print(
                        f"✅ Parsed {result['filename']} with {len(card_indexes)} cards. "
                        f"({result['duration_ms']:.1f} ms)"
                    )

                cards_per_second = (len(card_indexes) * 1000 / result['duration_ms']) if result['duration_ms'] > 0 else 0
                _append_parser_event(
                    "info",
                    f"Parsed {result['filename']}: {len(card_indexes)} cards in {result['duration_ms']:.2f}ms ({cards_per_second:.2f} cards/s)",
                    {
                        "filename": result['filename'],
                        "cards_indexed": len(card_indexes),
                        "parse_ms": round(result['duration_ms'], 2),
                        "cards_per_second": round(cards_per_second, 2),
                    },
                )
                processed += 1
            except Exception as e:
                print(f"❌ CRASHED on {filename}!")
                print(f"ERROR MESSAGE: {e}")
                traceback.print_exc()
                _append_parser_event("error", f"Failed parsing {filename}: {e}", {"filename": filename})
                failed += 1

            if progress_every > 0 and (index % progress_every == 0 or index == total_files):
                elapsed = time.perf_counter() - run_started
                rate = index / elapsed if elapsed > 0 else 0
                remaining = max(total_files - index, 0)
                eta_seconds = int(remaining / rate) if rate > 0 else 0
                eta_minutes = eta_seconds // 60
                eta_remainder = eta_seconds % 60
                print(
                    f"📊 Progress: {index}/{total_files} | success={processed} | failed={failed} | "
                    f"elapsed={elapsed:.1f}s | eta={eta_minutes:02d}:{eta_remainder:02d}"
                )

    flush_buffer("final")

    total_ms = (time.perf_counter() - run_started) * 1000
    print(f"⏱️ Completed {processed}/{total_files} files with {failed} failures in {total_ms:.1f} ms")
    _append_parser_event(
        "info",
        f"Local parser completed {processed}/{total_files} files with {failed} failures in {total_ms:.1f}ms",
        {
            "processed": processed,
            "total_files": total_files,
            "failed": failed,
            "total_ms": round(total_ms, 2),
        },
    )

if __name__ == '__main__':
    run_local_parser()