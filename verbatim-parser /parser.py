import sys
import os
import traceback
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from docx import Document
from card import TAG_NAME_SET, Card
from search import Search


def resolve_card_workers(default_cap=4):
  env_value = os.environ.get("PARSER_CARD_WORKERS")
  if env_value is not None:
    try:
      return max(1, int(env_value))
    except ValueError:
      pass

  cpu_count = os.cpu_count() or 1
  return max(1, min(default_cap, cpu_count))

class Parser():
  def __init__(self, filename, additional_info={}, max_workers=1, profile=False):
    self.filename = filename
    self.document = Document(self.filename)
    self.cards = []
    self.additional_info = additional_info
    self.max_workers = max(1, int(max_workers))
    self.profile = profile

  def _build_card(self, paragraphs):
    return Card(paragraphs, self.additional_info)
  

  def parse(self):
    start_time = time.perf_counter()
    current_card = []
    current_card_has_only_tags = True
    card_chunks = []
    print(f"Parsing {self.filename} (card_workers={self.max_workers})")
    
    for paragraph in self.document.paragraphs:
      style_name = paragraph.style.name

      if style_name in TAG_NAME_SET:
        if len(current_card) > 0 and current_card_has_only_tags:
            current_card.append(paragraph)
            continue

        if len(current_card) > 0:
          card_chunks.append(current_card)
        current_card = [paragraph]
        current_card_has_only_tags = True
      else:
        current_card.append(paragraph)
        current_card_has_only_tags = False

    if len(current_card) > 0:
      card_chunks.append(current_card)

    split_time = time.perf_counter()

    if self.max_workers == 1:
      for chunk in card_chunks:
        try:
          self.cards.append(self._build_card(chunk))
        except Exception as e:
          print(f"⚠️ Card skipped due to error: {e}")
    else:
      ordered_cards = [None] * len(card_chunks)
      with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
        future_map = {
          executor.submit(self._build_card, chunk): i
          for i, chunk in enumerate(card_chunks)
        }
        for future in as_completed(future_map):
          chunk_index = future_map[future]
          try:
            ordered_cards[chunk_index] = future.result()
          except Exception as e:
            print(f"⚠️ Card skipped due to error: {e}")

      self.cards = [card for card in ordered_cards if card is not None]

    done_time = time.perf_counter()

    if self.profile:
      split_ms = (split_time - start_time) * 1000
      parse_ms = (done_time - split_time) * 1000
      total_ms = (done_time - start_time) * 1000
      print(
        f"⏱️ parse profile | file={self.filename} | chunks={len(card_chunks)} | cards={len(self.cards)} | "
        f"split={split_ms:.1f}ms | build={parse_ms:.1f}ms | total={total_ms:.1f}ms | workers={self.max_workers}"
      )
    
    return self.cards

if __name__ == "__main__":
  if len(sys.argv) != 2:
    print("Usage: python3 parser.py <file.docx>")
    sys.exit(1)

  docx_name = sys.argv[1]
  if not os.path.isfile(docx_name):
    print("File not found")
    sys.exit(1)
  
  parser = Parser(
    docx_name,
    {"filename": docx_name},
    max_workers=resolve_card_workers(),
    profile=os.environ.get("PARSER_PROFILE", "0") == "1"
  )
  cards = parser.parse()
  print([{i:v for i,v in card.get_dynamo().items() if i != "body"} for card in cards])

  search = Search()
  search.upload_cards(cards)
  # search.upload_to_dynamo(cards)