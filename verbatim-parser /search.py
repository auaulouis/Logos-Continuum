from dotenv import load_dotenv
import json
import os
from datetime import datetime, timezone

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
      self._write_cards([])

  def _read_cards(self):
    try:
      with open(self.index_path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
        if isinstance(data, list):
          return data
    except (json.JSONDecodeError, FileNotFoundError):
      pass
    return []

  def _write_cards(self, cards):
    with open(self.index_path, "w", encoding="utf-8") as handle:
      json.dump(cards, handle)

  def get_all_cards(self):
    return self._read_cards()

  def clear_index(self):
    self._write_cards([])

  def check_filename_in_search(self, filename):
    if not filename:
      return False

    target = str(filename).strip().lower()
    if target == "":
      return False

    return any(str(card.get("filename", "")).strip().lower() == target for card in self._read_cards())

  def get_by_id(self, card_id):
    card_id = str(card_id)
    for card in self._read_cards():
      if str(card.get("id", "")) == card_id:
        return card
    return None

  def upload_cards(self, cards, force_upload=False):
    card_objects = [card.get_index() for card in cards]
    if len(card_objects) == 0:
      return

    filename = card_objects[0].get("filename")
    if filename is not None and not force_upload and self.check_filename_in_search(filename):
      print(f"{filename} already in search, skipping")
      return

    existing_cards = self._read_cards()
    existing_by_id = {str(card.get("id")): card for card in existing_cards if card.get("id") is not None}

    for card in card_objects:
      card_id = card.get("id")
      if card_id is None:
        continue
      existing_by_id[str(card_id)] = card

    merged_cards = list(existing_by_id.values())
    self._write_cards(merged_cards)

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
