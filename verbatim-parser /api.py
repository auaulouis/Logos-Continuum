from flask import Flask, request
from flask_cors import CORS
from dotenv import load_dotenv
from search import Search
from parser import Parser
import os
import glob
import asyncio

load_dotenv()

app = Flask(__name__)
CORS(app)

LOCAL_DOCS_FOLDER = os.environ.get("LOCAL_DOCS_FOLDER", "./local_docs")


def _index_local_docs_if_empty(search_client):
  if len(search_client.get_all_cards()) > 0:
    return

  files = glob.glob(os.path.join(LOCAL_DOCS_FOLDER, "**/*.docx"), recursive=True)
  files = [path for path in files if not os.path.basename(path).startswith("~$")]

  if len(files) == 0:
    print(f"No local .docx files found in {LOCAL_DOCS_FOLDER}; starting API with empty index")
    return

  print(f"Local index is empty. Parsing {len(files)} local .docx files...")
  for path in files:
    filename = os.path.basename(path)
    folder = os.path.dirname(path)
    parser = Parser(path, {
      "filename": filename,
      "division": "local",
      "year": "local",
      "school": "Local",
      "team": "Local",
      "download_url": "local"
    })
    cards = parser.parse()
    search_client.upload_cards(cards, force_upload=True)


class Api:
  def __init__(self):
    self.search = Search()
    _index_local_docs_if_empty(self.search)

  async def query(self, q, from_value=0, start_date="", end_date="", exclude_sides="", exclude_division="", exclude_years="", exclude_schools="", sort_by="", cite_match=""):
    return self.search.query(
      q,
      from_value=from_value,
      start_date=start_date,
      end_date=end_date,
      exclude_sides=exclude_sides,
      exclude_division=exclude_division,
      exclude_years=exclude_years,
      exclude_schools=exclude_schools,
      sort_by=sort_by,
      cite_match=cite_match
    )

  def get_colleges(self):
    return self.search.get_colleges()

  async def get_by_id(self, card_id, preview=False):
    card_data = self.search.get_by_id(card_id)
    if card_data is None:
      return None

    if "highlights" not in card_data:
      card_data["highlights"] = []
    if "underlines" not in card_data:
      card_data["underlines"] = []
    if "emphasis" not in card_data:
      card_data["emphasis"] = []

    return card_data


@app.route("/query", methods=['GET'])
def query():
  search = request.args.get('search', '')
  cursor = int(request.args.get('cursor', 0))
  start_date = request.args.get('start_date', '')
  end_date = request.args.get('end_date', '')
  exclude_sides = request.args.get('exclude_sides', '')
  exclude_division = request.args.get('exclude_division', '')
  exclude_schools = request.args.get('exclude_schools', '')
  exclude_years = request.args.get('exclude_years', '')
  sort_by = request.args.get('sort_by', '')
  cite_match = request.args.get('cite_match', '')

  api = Api()
  results, next_cursor = asyncio.run(api.query(
    search,
    cursor,
    start_date=start_date,
    end_date=end_date,
    exclude_sides=exclude_sides,
    exclude_division=exclude_division,
    exclude_schools=exclude_schools,
    exclude_years=exclude_years,
    sort_by=sort_by,
    cite_match=cite_match
  ))
  return {"count": len(results), "results": results, "cursor": next_cursor}


@app.route("/card", methods=['GET'])
def get_card():
  card_id = request.args.get('id')
  api = Api()
  result = asyncio.run(api.get_by_id(card_id, False))
  return result


@app.route("/schools", methods=['GET'])
def get_schools_list():
  api = Api()
  schools = api.get_colleges()
  return {"colleges": schools}


if __name__ == '__main__':
  app.run(port=int(os.environ.get('PORT', '5001')), host='0.0.0.0', debug=True)
