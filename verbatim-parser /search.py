from dotenv import load_dotenv
import json
import os
from datetime import datetime, timezone
from fcntl import flock, LOCK_EX, LOCK_UN

load_dotenv()

LOCAL_INDEX_PATH = os.environ.get("LOCAL_INDEX_PATH", "./local_docs/cards_index.json")


def _to_unix_timestamp(date_value):
  if date_value in (None, ""):
    return None

  if isinstance(date_value, (int, float)):
    return int(date_value)

  value = str(date_value).strip()
  if value == "":
    return None

  try:
    return int(float(value))
  except ValueError:
    pass

  for date_format in ("%Y-%m-%d", "%Y/%m/%d"):
    try:
      dt = datetime.strptime(value, date_format).replace(tzinfo=timezone.utc)
      return int(dt.timestamp())
    except ValueError:
      continue

  return None


class Search:
  def __init__(self, index_path=LOCAL_INDEX_PATH):
    self.index_path = index_path
    os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
    if not os.path.exists(self.index_path):
      self._reset_index_file()
    self._seen_ids = set()
    self._seen_filenames = set()
    self._index_loaded = False

  def _reset_index_file(self):
    with open(self.index_path, "w", encoding="utf-8") as handle:
      handle.write("")

  def _is_legacy_json_array(self):
    try:
      with open(self.index_path, "r", encoding="utf-8") as handle:
        while True:
          ch = handle.read(1)
          if ch == "":
            return False
          if not ch.isspace():
            return ch == "["
    except FileNotFoundError:
      return False

  def _append_card_dicts(self, card_dicts):
    if len(card_dicts) == 0:
      return

    with open(self.index_path, "a", encoding="utf-8") as handle:
      flock(handle.fileno(), LOCK_EX)
      try:
        for card in card_dicts:
          handle.write(json.dumps(card, ensure_ascii=False) + "\n")
      finally:
        flock(handle.fileno(), LOCK_UN)

  def _ensure_runtime_indexes(self):
    if self._index_loaded:
      return

    for card in self._read_cards():
      card_id = card.get("id")
      if card_id is not None:
        self._seen_ids.add(str(card_id))

      filename = str(card.get("filename", "")).strip().lower()
      if filename:
        self._seen_filenames.add(filename)

    self._index_loaded = True

  def _migrate_legacy_array_to_jsonl(self):
    if not self._is_legacy_json_array():
      return

    legacy_cards = self._read_cards()
    self._reset_index_file()
    self._append_card_dicts(legacy_cards)

  def _read_cards(self):
    try:
      with open(self.index_path, "r", encoding="utf-8") as handle:
        content = handle.read()
        if content.strip() == "":
          return []

      stripped = content.lstrip()
      if stripped.startswith("["):
        data = json.loads(content)
        if isinstance(data, list):
          return data
        return []

      cards = []
      for line in content.splitlines():
        line = line.strip()
        if not line:
          continue
        try:
          parsed = json.loads(line)
          if isinstance(parsed, dict):
            cards.append(parsed)
        except json.JSONDecodeError:
          continue
      return cards
    except (json.JSONDecodeError, FileNotFoundError):
      pass
    return []

  def get_all_cards(self):
    return self._read_cards()

  def clear_index(self):
    self._reset_index_file()
    self._seen_ids.clear()
    self._seen_filenames.clear()
    self._index_loaded = True

  def get_document_summaries(self):
    documents = {}
    for card in self._read_cards():
      filename = str(card.get("filename", "")).strip()
      if not filename:
        continue

      key = filename.lower()
      if key not in documents:
        documents[key] = {
          "filename": filename,
          "cards_indexed": 0,
        }
      documents[key]["cards_indexed"] += 1

    return sorted(documents.values(), key=lambda item: item["filename"].lower())

  def delete_document_from_index(self, filename):
    target = str(filename).strip().lower()
    if target == "":
      return 0

    cards = self._read_cards()
    kept_cards = []
    removed = 0

    for card in cards:
      card_filename = str(card.get("filename", "")).strip().lower()
      if card_filename == target:
        removed += 1
      else:
        kept_cards.append(card)

    self._reset_index_file()
    self._append_card_dicts(kept_cards)

    self._seen_ids.clear()
    self._seen_filenames.clear()
    for card in kept_cards:
      card_id = card.get("id")
      if card_id is not None:
        self._seen_ids.add(str(card_id))

      card_filename = str(card.get("filename", "")).strip().lower()
      if card_filename:
        self._seen_filenames.add(card_filename)
    self._index_loaded = True

    return removed

  def check_filename_in_search(self, filename):
    if not filename:
      return False

    target = str(filename).strip().lower()
    if target == "":
      return False

    self._ensure_runtime_indexes()
    return target in self._seen_filenames

  def get_by_id(self, card_id):
    card_id = str(card_id)
    for card in self._read_cards():
      if str(card.get("id", "")) == card_id:
        return card
    return None

  def upload_cards(self, cards, force_upload=False):
    card_objects = [card.get_index() for card in cards]
    self.upload_card_indexes(card_objects, force_upload=force_upload)

  def upload_card_indexes(self, card_objects, force_upload=False):
    if len(card_objects) == 0:
      return

    self._migrate_legacy_array_to_jsonl()
    self._ensure_runtime_indexes()

    filename = card_objects[0].get("filename")
    normalized_filename = str(filename).strip().lower() if filename is not None else ""
    if normalized_filename and not force_upload and normalized_filename in self._seen_filenames:
      print(f"{filename} already in search, skipping")
      return

    to_append = []
    for card in card_objects:
      card_id = card.get("id")
      if card_id is None:
        continue
      card_id_str = str(card_id)
      if card_id_str in self._seen_ids:
        continue
      self._seen_ids.add(card_id_str)
      to_append.append(card)

    self._append_card_dicts(to_append)

    if normalized_filename:
      self._seen_filenames.add(normalized_filename)

    if filename is not None:
      print(f"Indexed locally: {filename}")
    else:
      print("Indexed locally")

  def upload_to_dynamo(self, cards):
    self.upload_cards(cards)

  def query(self, q, from_value=0, start_date="", end_date="", exclude_sides="", exclude_division="", exclude_years="", exclude_schools="", sort_by="", cite_match=""):
    cards = self._read_cards()

    quoted_phrases = []
    remaining_text = q or ""
    while '"' in remaining_text:
      first = remaining_text.find('"')
      second = remaining_text.find('"', first + 1)
      if second == -1:
        break
      phrase = remaining_text[first + 1:second].strip().lower()
      if phrase:
        quoted_phrases.append(phrase)
      remaining_text = f"{remaining_text[:first]} {remaining_text[second + 1:]}"

    terms = [term.strip().lower() for term in remaining_text.split() if term.strip()]

    excluded_sides = set(s.strip().lower() for s in str(exclude_sides).split(",") if s.strip())
    excluded_divisions = set(d.split("-")[0].strip().lower() for d in str(exclude_division).split(",") if d.strip())
    excluded_years_set = set(y.strip().lower() for y in str(exclude_years).split(",") if y.strip())
    excluded_schools_set = set(s.strip().lower() for s in str(exclude_schools).split(",") if s.strip())

    start_ts = _to_unix_timestamp(start_date)
    end_ts = _to_unix_timestamp(end_date)

    filtered = []
    for card in cards:
      filename = str(card.get("filename", "")).lower()
      division = str(card.get("division", "")).lower()
      year = str(card.get("year", "")).lower()
      school = str(card.get("school", "")).lower()
      cite = str(card.get("cite", ""))

      if excluded_sides and any(side in filename for side in excluded_sides):
        continue
      if excluded_divisions and division in excluded_divisions:
        continue
      if excluded_years_set and year in excluded_years_set:
        continue
      if excluded_schools_set and school in excluded_schools_set:
        continue

      if start_ts is not None and end_ts is not None:
        card_date = card.get("cite_date")
        card_ts = _to_unix_timestamp(card_date)
        if card_ts is None or card_ts < start_ts or card_ts > end_ts:
          continue

      if cite_match:
        if str(cite_match).lower() not in cite.lower():
          continue

      searchable_text = " ".join([
        str(card.get("tag", "")),
        str(card.get("highlighted_text", "")),
        str(card.get("cite", "")),
        " ".join(card.get("body", []) if isinstance(card.get("body"), list) else [str(card.get("body", ""))])
      ]).lower()

      if any(phrase not in searchable_text for phrase in quoted_phrases):
        continue
      if any(term not in searchable_text for term in terms):
        continue

      filtered.append(card)

    if sort_by == "date":
      filtered.sort(key=lambda c: _to_unix_timestamp(c.get("cite_date")) or 0, reverse=True)

    page = filtered[from_value:from_value + 20]
    cursor = from_value + len(page)
    return page, cursor

  def get_colleges(self):
    schools = sorted({str(card.get("school", "")).strip() for card in self._read_cards() if str(card.get("school", "")).strip()})
    return schools
