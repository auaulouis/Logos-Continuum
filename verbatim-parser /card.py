import hashlib
from date_test import generate_date_from_cite
# from docx.text.paragraph import Paragraph
import re

# Paragraph.text = property(lambda self: GetParagraphText(self))

# def GetParagraphText(paragraph):
#   def GetTag(element):
#       return "%s:%s" % (element.prefix, re.match("{.*}(.*)", element.tag).group(1))

#   text = ''
#   runCount = 0
#   for child in paragraph._p:
#       tag = GetTag(child)
#       if tag == "w:r":
#           text += paragraph.runs[runCount].text
#           runCount += 1
#       if tag == "w:hyperlink":
#           for subChild in child:
#               if GetTag(subChild) == "w:r":
#                   text += subChild.text
#   return text

TAG_NAME = ["Heading 4", "Tags", "Tag", "Heading 3", "Heading 2"]
TAG_NAME_SET = set(TAG_NAME)
NORMAL_NAME = ["Normal", "Cards", "card", "Normal (Web)", "Normal/Card"]
NORMAL_NAME_SET = set(NORMAL_NAME)
EMPHASIS_NAME = "Emphasis"
UNDERLINE_NAME = "Underline"
LIST_PARAGRAPH_NAME = "List Paragraph"
CITE_NAME = ["13 pt Bold", "Cites"]
CITE_NAME_SET = set(CITE_NAME)


def _document_number(filename):
  normalized = str(filename or "").strip().lower()
  if normalized == "":
    normalized = "local"
  digest = hashlib.sha256(normalized.encode()).hexdigest()
  return int(digest[:8], 16) % 100000


def _format_card_identifier(filename, card_number):
  padded = f"{int(card_number):010d}"
  return f"CID-{padded[:5]}-{padded[5:]}"


class Card():
  def __init__(self, paragraphs, additional_info):
    if len(paragraphs) < 2 or paragraphs[0].style.name not in TAG_NAME_SET:
      raise Exception("Invalid paragraph structure")

    self.paragraphs = paragraphs
    self.tag_base = paragraphs[0].text.strip(", ")
    self.card_number = None
    self.card_identifier = ""
    self.card_identifier_token = ""
    self.tag = self.tag_base
    self.tag_sub = ""
    self.body = []
    tag_sub_parts = []
    for i in range(1, len(paragraphs)):
      paragraph_text = paragraphs[i].text
      if not any(c.isdigit() for c in paragraph_text):
        tag_sub_parts.append(paragraph_text)
      else:
        self.cite = paragraph_text
        self.cite_i = i
        self.body = [p.text for p in paragraphs[i+1:] if p.style.name in NORMAL_NAME_SET or p.style.name == LIST_PARAGRAPH_NAME]
        break

    if tag_sub_parts:
      self.tag_sub = "\n".join(tag_sub_parts) + "\n"

    if not self.body or len("".join(self.body)) < 25:
      raise Exception("Card is too short")

    self.cite_emphasis = []
    self.highlights = []
    self.highlighted_text = ""
    self.emphasis = []
    self.underlines = []
    self.parse_paragraphs()

    self.additional_info = additional_info
    self.object_id = hashlib.sha256(str(self).encode()).hexdigest()
    self.cite_date = generate_date_from_cite(self.cite)

  def get_registry_key(self):
    filename = str(self.additional_info.get("filename", "")).strip().lower()
    body_text = "\n".join(self.body)
    source = f"{filename}\n{self.tag_base}\n{self.cite}\n{body_text}"
    return hashlib.sha256(source.encode()).hexdigest()

  def assign_identifier_number(self, identifier_number):
    self.card_number = int(identifier_number)
    self.card_identifier = _format_card_identifier(self.additional_info.get("filename"), self.card_number)
    self.card_identifier_token = f"[[{self.card_identifier}]]"
    self.tag = f"{self.tag_base} {self.card_identifier_token}".strip()

  def parse_paragraphs(self):
    j = 0
    highlighted_parts = []
    cite_paragraph = self.paragraphs[self.cite_i]
    cite_text = cite_paragraph.text

    for r in cite_paragraph.runs:
      run_text = r.text.strip()
      if not run_text:
        continue

      run_index = cite_text.find(run_text, j)

      if run_index == -1:
        continue

      run_style = r.style
      run_style_name = run_style.name if run_style else ""
      run_style_font = run_style.font if run_style else None
      if run_style_name in CITE_NAME_SET or ((run_style_font and run_style_font.bold) or r.font.bold):
        self.cite_emphasis.append((run_index, run_index + len(run_text)))
      
      j = run_index + len(run_text)

    p_index = 2

    for i in range(self.cite_i + 1, len(self.paragraphs)):
      p = self.paragraphs[i]
      runs = p.runs
      paragraph_text = p.text
      j = 0

      for r in runs:
        run_text = r.text.strip()
        if not run_text:
          continue

        run_index = paragraph_text.find(run_text, j)

        if run_index == -1:
          continue

        run_style = r.style
        run_style_name = run_style.name if run_style else ""
        run_style_font = run_style.font if run_style else None
        if r.font.highlight_color is not None:
          self.highlights.append((p_index, run_index, run_index + len(run_text)))
          highlighted_parts.append(run_text)
        if UNDERLINE_NAME in run_style_name or r.font.underline or (run_style_font and run_style_font.underline):
          self.underlines.append((p_index, run_index, run_index + len(run_text)))
        if EMPHASIS_NAME in run_style_name:
          self.emphasis.append((p_index, run_index, run_index + len(run_text)))
        
        j = run_index + len(run_text)
      
      p_index += 1

    self.highlighted_text = " ".join(highlighted_parts)
  
  def get_index(self):
    index = {
      "tag": self.tag,
      "tag_base": self.tag_base,
      "card_number": self.card_number,
      "card_identifier": self.card_identifier,
      "card_identifier_token": self.card_identifier_token,
      "cite": self.cite,
      "body": self.body,
      "id": self.object_id,
      "highlighted_text": self.highlighted_text,
      "highlights": self.highlights,
      "underlines": self.underlines,
      "emphasis": self.emphasis,
      "cite_emphasis": self.cite_emphasis,
      **self.additional_info
    }
    if self.cite_date is not None:
      index["cite_date"] = self.cite_date.strftime("%Y-%m-%d")
    return index
  
  def get_dynamo(self):
    db_representation = {
      "tag": {"S": self.tag},
      "tag_base": {"S": self.tag_base},
      "card_number": {"N": str(self.card_number)},
      "card_identifier": {"S": self.card_identifier},
      "card_identifier_token": {"S": self.card_identifier_token},
      "tag_sub": {"S": self.tag_sub},
      "cite": {"S": self.cite},
      "highlighted_text": {"S": self.highlighted_text},
      "body": {"L": [{"S":p} for p in self.body]},
      "highlights": { "L": [ { "L": [ {"N":str(i)} for i in v ] } for v in self.highlights ] },
      "emphasis": {"L": [{"L": [{"N":str(i)} for i in v]} for v in self.emphasis]},
      "underlines": {"L": [{"L": [{"N":str(i)} for i in v]} for v in self.underlines]},
      "cite_emphasis": {"L": [{"L": [{"N":str(i)} for i in v]} for v in self.cite_emphasis]},
      "id": {"S": self.object_id}
    }
    
    if self.additional_info.get("division") is not None and self.additional_info.get("year") is not None and self.additional_info.get("download_url") is not None:
      db_representation["division"] = {"S": self.additional_info["division"]}
      db_representation["year"] = {"S": self.additional_info["year"]}
      db_representation["download_url"] = {"S": self.additional_info["download_url"]}
      db_representation["filename"] = {"S": self.additional_info["filename"]}
      db_representation["school"] = {"S": self.additional_info["school"]}
      db_representation["team"] = {"S": self.additional_info["team"]}
    
    if self.cite_date is not None:
      db_representation["cite_date"] = {"S": self.cite_date.strftime("%Y-%m-%d")}

    return db_representation

  def __str__(self):
    return f"{self.tag_base}\n{self.cite}\n{self.body}\n"

  def __repr__(self):
    return f"\n{self.tag_base}\n{self.cite}\n{self.body}\n"
