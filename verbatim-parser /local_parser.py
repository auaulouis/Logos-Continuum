from scraper import parse_and_upload
import os
import glob
import time

LOCAL_FOLDER = "./local_docs"

def run_local_parser():
    files = glob.glob(os.path.join(LOCAL_FOLDER, "**/*.docx"), recursive=True)
    if not files:
        print(f"⚠️ No files found in {LOCAL_FOLDER}")
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
    run_started = time.perf_counter()
    processed = 0
    failed = 0
    progress_every = int(os.environ.get("LOCAL_PARSER_PROGRESS_EVERY", "100"))

    for index, filepath in enumerate(files, start=1):
        filename = os.path.basename(filepath)
        if filename.startswith("~$"): continue
        
        print(f"🛠️  Processing: {filename}...")
        started = time.perf_counter()
        try:
            # We run this one-by-one so we can see errors
            was_successful = parse_and_upload(
                os.path.dirname(filepath) + "/",
                filename,
                {"url": "local", "year": "2026"},
                check_existing=False
            )
            duration_ms = (time.perf_counter() - started) * 1000
            if was_successful:
                print(f"✅ Successfully sent {filename} to scraper. ({duration_ms:.1f} ms)")
                processed += 1
            else:
                print(f"❌ Failed to process {filename}. ({duration_ms:.1f} ms)")
                failed += 1
        except Exception as e:
            print(f"❌ CRASHED on {filename}!")
            print(f"ERROR MESSAGE: {e}")
            # This will tell us exactly which file and line broke
            import traceback
            traceback.print_exc()
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

    total_ms = (time.perf_counter() - run_started) * 1000
    print(f"⏱️ Completed {processed}/{total_files} files with {failed} failures in {total_ms:.1f} ms")

if __name__ == '__main__':
    run_local_parser()