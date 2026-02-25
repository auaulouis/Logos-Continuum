from scraper import parse_and_upload
import os
import glob

LOCAL_FOLDER = "./local_docs"

def run_local_parser():
    files = glob.glob(os.path.join(LOCAL_FOLDER, "**/*.docx"), recursive=True)
    if not files:
        print(f"⚠️ No files found in {LOCAL_FOLDER}")
        return

    print(f"🔎 Found {len(files)} files. Starting diagnostic parse...")

    for filepath in files:
        filename = os.path.basename(filepath)
        if filename.startswith("~$"): continue
        
        print(f"🛠️  Processing: {filename}...")
        try:
            # We run this one-by-one so we can see errors
            parse_and_upload(os.path.dirname(filepath) + "/", filename, {"url": "local", "year": "2026"})
            print(f"✅ Successfully sent {filename} to scraper.")
        except Exception as e:
            print(f"❌ CRASHED on {filename}!")
            print(f"ERROR MESSAGE: {e}")
            # This will tell us exactly which file and line broke
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    run_local_parser()