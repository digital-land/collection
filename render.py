#!/usr/bin/env python3

import os
import json
import jinja2

from filters import slash_to_dash


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

# retrieve page templates
collections_template = env.get_template("collections.html")
collections_log_date_template = env.get_template("collections-log-date.html")


def get_dummy_data(filename):
    # read file
    with open(f"{dummy_data_path}/{filename}.json", 'r') as f:
        data=f.read()

    # parse file
    return json.loads(data)


# To be replaced
# get dummy data for templates
collections_data = get_dummy_data("collections")
collections_log_date_data = get_dummy_data("collections-log-date")


# render pages
def render(path, template, **kwargs):
    path = os.path.join(docs_path, path)
    directory = os.path.dirname(path)
    if not os.path.exists(directory):
        os.makedirs(directory)

    with open(path, "w") as f:
        f.write(template.render(staticPath=static_folder_path, **kwargs))


render("index.html", collections_template, data=collections_data)
render("log/04-06-2020/index.html", collections_log_date_template, data=collections_log_date_data)
