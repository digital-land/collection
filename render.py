#!/usr/bin/env python3

import os
import json
import jinja2

from filters import slash_to_dash, extract_month, map_month, extract_day

data_path = "data"
dummy_data_path = "dummy_data"
docs_path = "docs/"
static_folder_path = "https://digital-land-design.herokuapp.com/static"

# jinja setup
multi_loader = jinja2.ChoiceLoader([
    jinja2.FileSystemLoader(searchpath="./templates"),
    jinja2.PrefixLoader({
        'govuk-jinja-components': jinja2.PackageLoader('govuk_jinja_components')
    })
])
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
    with open(f"{path}.json", 'r') as f:
        data=f.read()

    # parse file
    return json.loads(data)

collections_data = get_data(f"{data_path}/by-collection")
collections_log_data = get_data(f"{data_path}/by-date")

# render pages
def render(path, template, **kwargs):
    path = os.path.join(docs_path, path)
    directory = os.path.dirname(path)
    if not os.path.exists(directory):
        os.makedirs(directory)

    with open(path, "w") as f:
        f.write(template.render(staticPath=static_folder_path, **kwargs))


# by collection
render("index.html", collections_template, data=collections_data)
for collection in collections_data['collections']:
    render(f"{collection['collection']}/index.html", a_collection_template, data=collection)
    render(f"{collection['collection']}/log/index.html", a_collection_log_template, data=collection, heatmap=collection['heatmap'])

    for history in collection['history']:
        render(f"{collection['collection']}/log/{history['date']}/index.html", a_collection_log_date_template, collection=collection, data=history)

# by date
render("log/index.html", collections_log_template, data=collections_log_data)
for log in collections_log_data:
    render(f"log/{log['date']}/index.html", collections_log_date_template, data=log)
