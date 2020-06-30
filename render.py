#!/usr/bin/env python3

import os
import json
import jinja2

from filters import slash_to_dash, extract_month, map_month, extract_day


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

# --- To be replaced ---
def get_dummy_data(filename):
    # read file
    with open(f"{dummy_data_path}/{filename}.json", 'r') as f:
        data=f.read()

    # parse file
    return json.loads(data)

# get dummy data for templates
collections_data = get_dummy_data("collections")
collections_log_data = get_dummy_data("collections-log")
collections_log_date_data = get_dummy_data("collections-log-date")

collection_data = get_dummy_data("collection")
# get for single example
brownfield_collection_log_data = get_dummy_data("brownfield-collection-log")
heatmap_example_data = get_dummy_data("heatmaps")
brownfield_collection_log_date_data = get_dummy_data("brownfield-collection-log-date")
# --- --- --- --- --- ---


# render pages
def render(path, template, **kwargs):
    path = os.path.join(docs_path, path)
    directory = os.path.dirname(path)
    if not os.path.exists(directory):
        os.makedirs(directory)

    with open(path, "w") as f:
        f.write(template.render(staticPath=static_folder_path, **kwargs))


render("index.html", collections_template, data=collections_data)
render("log/index.html", collections_log_template, data=collections_log_data)
render("log/2020-06-04/index.html", collections_log_date_template, data=collections_log_date_data)
for collection in collection_data:
    render(f"{collection['collection']}/index.html", a_collection_template, data=collection)
render("brownfield-land/log/index.html", a_collection_log_template, data=brownfield_collection_log_data, heatmap=heatmap_example_data)

for d in brownfield_collection_log_date_data['result'].keys():
    run_result_data = brownfield_collection_log_date_data['result'][d]
    run_result_data['date'] = d
    render(f"brownfield-land/log/{d}/index.html", a_collection_log_date_template, collection=brownfield_collection_log_date_data['collection'], data=run_result_data)

