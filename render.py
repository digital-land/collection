#!/usr/bin/env python3

import datetime
import itertools
import json
import logging
from collections import defaultdict
from pathlib import Path

import jinja2
from digital_land.collection import Collection
from digital_land_frontend.render import Renderer

from filters import extract_day, extract_month, map_month, slash_to_dash

data_path = "new_data"
dummy_data_path = "dummy_data"
docs_path = Path("docs/")
static_folder_path = "https://digital-land-design.herokuapp.com/static"

# jinja setup
multi_loader = jinja2.ChoiceLoader(
    [
        jinja2.FileSystemLoader(searchpath="./templates"),
        jinja2.PrefixLoader(
            {"govuk-jinja-components": jinja2.PackageLoader("govuk_jinja_components")}
        ),
    ]
)
env = jinja2.Environment(loader=multi_loader)

# load any filters the templates need
env.filters["slash_to_dash"] = slash_to_dash
env.filters["extract_day"] = extract_day
env.filters["get_month"] = extract_month
env.filters["map_month"] = map_month

# retrieve page templates
collections_template = env.get_template("collections.html")
collections_log_template = env.get_template("collections-log.html")
collections_log_date_template = env.get_template("collections-log-date.html")

a_collection_template = env.get_template("a-collection.html")
a_collection_log_template = env.get_template("a-collection-log.html")
a_collection_log_date_template = env.get_template("a-collection-log-date.html")

# get data
def get_data(path):
    # read file
    with open(f"{path}.json", "r") as f:
        data = f.read()

    # parse file
    return json.loads(data)


# collections_data = get_data(f"{data_path}/by-collection")
# collections_log_data = get_data(f"{data_path}/by-date")


def render(path, template, **kwargs):
    Path(docs_path / path).parent.mkdir(parents=True, exist_ok=True)
    Renderer.render(docs_path / path, template, staticPath=static_folder_path, **kwargs)


class DataBuilder:
    def __init__(self, collection, name):
        self.name = name
        self.collection_dir = Path(f"collections/{collection}-collection")
        self.log_dir = self.collection_dir / "log"
        self.c = Collection(name=collection, directory=self.collection_dir)
        self.c.load()
        self.index_runs()
        self.summarise_runs()
        self.build_heatmap()

    def index_runs(self):
        self.run_log = {}
        for entry in self.c.log.entries:
            key = entry["entry-date"][:10]
            self.run_log.setdefault(key, [])
            self.run_log[key].append(entry)

        self.sorted_runs = sorted(list(self.run_log.keys()))
        self.first_run = self.sorted_runs[0]
        self.last_run = self.sorted_runs[-1]

    def summarise_runs(self):
        self.seen_resources = set()
        self.run = dict()
        for key in self.sorted_runs:
            self.run[key] = self.summarise_run(key)
        print("finished summarising runs")

    def summarise_run(self, key):
        summary = defaultdict(list)
        endpoints = {
            "success": 0,
            "fail": 0,
            "total_count": 0,
            "last_updated": "TODO",
            "issues": defaultdict(list),
        }
        doc_urls = {"active": 0, "inactive": 0}  # TODO what should these be?
        new_resources = []
        issues = []
        for f in Path(self.log_dir / key).glob("*.json"):
            log = json.load(f.open())
            endpoints["total_count"] += 1

            if not log.get("resource", None):
                status = log.get("status", "Unknown")
                issue = {
                    "endpoint": log.get("endpoint-url", None)
                    or log.get("url", None),
                    "link": f.stem,
                    "log_link": f"https://raw.githubusercontent.com/digital-land/{self.c.name}-collection/main/collection/log/{key}/{f.name}",
                    "documentation_urls": list(
                        {
                            e["documentation-url"]
                            for e in self.c.source.records[f.stem]
                        }
                    ),
                }
                endpoints["fail"] += 1
                endpoints["issues"][status].append(issue)
                resp_headers = log.get("response-headers", {})
                issues.append(
                    {
                        "datetime": log.get("entry-date", None) or log.get("datetime", "")[:10],
                        "link": f.stem,
                        "status": log.get("status", None),
                        "elapsed": log.get("elapsed", None),
                        "resource": None,
                        "content-type": resp_headers.get("Content-Type", None),
                        "content-length": resp_headers.get("Content-Length", None),
                        "date": key,
                    }
                )
                continue

            endpoints["success"] += 1
            summary["success"].append(log)
            if log["resource"] not in self.seen_resources:
                new_resources.append(log["resource"])
                self.seen_resources.add(log["resource"])

        return {
            "collection": self.c.name,
            "name": self.name,
            "ran": True,
            "date": key,
            "endpoints": endpoints,
            "documentation_urls": doc_urls,
            "new_resources": new_resources,
            "issues": issues,
        }

    def build_heatmap(self):
        self.heatmap = {
            "new_resources": {"highest": 0, "weeks": []},
            "issues": {"highest": 0, "weeks": []},
        }

        today = datetime.date.today()
        start_date = datetime.date(today.year - 1, today.month, today.day)
        current_date = start_date
        day_count = 0
        issue_batch = {}
        new_resource_batch = {}
        while current_date <= today:
            day_count += 1
            key = current_date.strftime("%Y-%m-%d")
            if key in self.run:
                run = self.run[key]

                if len(run["new_resources"]) > self.heatmap["new_resources"]["highest"]:
                    self.heatmap["new_resources"]["highest"] = len(run["new_resources"])
                new_resource_batch[key] = {
                    "count": len(run["new_resources"]),
                    "tooltip": f"{len(run['new_resources'])} new resources",
                }

                if len(run["issues"]) > self.heatmap["issues"]["highest"]:
                    self.heatmap["new_resources"]["highest"] = len(run["issues"])
                issue_batch[key] = {
                    "count": len(run["issues"]),
                    "tooltip": f"{len(run['issues'])} issues",
                }

                if day_count % 7:
                    self.heatmap["new_resources"]["weeks"].append(new_resource_batch)
                    self.heatmap["issues"]["weeks"].append(issue_batch)
                    new_resource_batch = {}
                    issue_batch = {}

            current_date += datetime.timedelta(days=1)

    def build_by_collection(self):
        result = {
            "collection": self.c.name,
            "name": self.name,
            "active": True,
            "repository": f"https://github.com/digital-land/{self.c.name}-collection",
            "total_resource_count": len(self.c.resource),
            "total_runs": len(self.run_log),
            "first_run": self.run[self.first_run],
            "last_run": self.run[self.last_run],
            "history": list(self.run.values()),
            "endpoints": self.run[self.last_run]["endpoints"],
            "heatmap": self.heatmap,
        }
        return result


def build_by_date(builders):
    result = []
    all_keys = itertools.chain.from_iterable([b.run_log.keys() for b in builders])
    __import__("pdb").set_trace()
    for key in reversed(sorted(list(set(all_keys)))):
        result += [b.run[key] for b in builders if key in b.run]
        # result.append(self.run[key])
    return result


collections_data = {
    "active_count": 0,
    "inactive_count": 0,
    "total_count": 0,
    "collections": [],
}

builders = []
for collection, name in [
    ("brownfield-land", "Brownfield land"),
    ("conservation-area", "Conservation area"),
]:
    builder = DataBuilder(collection, name)
    builders.append(builder)
    collections_data["active_count"] += 1
    collections_data["total_count"] += 1
    collections_data["collections"].append(builder.build_by_collection())

by_collection_file = "new_data/by-collection.json"
json.dump(collections_data, open(by_collection_file, "w"))

collections_log_data = build_by_date(builders)
by_date_file = "new_data/by-date.json"
json.dump(collections_log_data, open(by_date_file, "w"))

print("finished building data")

# by collection
render("index.html", collections_template, data=collections_data)
for collection in collections_data["collections"]:
    render(
        f"{collection['collection']}/index.html", a_collection_template, data=collection
    )
    render(
        f"{collection['collection']}/log/index.html",
        a_collection_log_template,
        data=collection,
        heatmap=collection["heatmap"],
    )

    for history in collection["history"]:
        render(
            f"{collection['collection']}/log/{history['date']}/index.html",
            a_collection_log_date_template,
            collection=collection,
            data=history,
        )

# by date
render("log/index.html", collections_log_template, data=collections_log_data)
for log in collections_log_data:
    render(f"log/{log['date']}/index.html", collections_log_date_template, data=log)

print("complete!")
