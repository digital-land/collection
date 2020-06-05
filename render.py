#!/usr/bin/env python3

import os
import json
import jinja2


dummy_data_path = "dummy_data"
docs_path = "docs/"
static_folder_path = "http://digital-land-design.herokuapp.com/static"

# jinja setup
multi_loader = jinja2.ChoiceLoader([
    jinja2.FileSystemLoader(searchpath="./templates"),
    jinja2.PrefixLoader({
        'govuk-jinja-components': jinja2.PackageLoader('govuk_jinja_components')
    })
])
env = jinja2.Environment(loader=multi_loader)

# retrieve page templates
collections_template = env.get_template("collections.html")


def get_dummy_data(filename):
    # read file
    with open(f"{dummy_data_path}/{filename}.json", 'r') as f:
        data=f.read()

    # parse file
    return json.loads(data)



# render pages
def render(path, template, **kwargs):
    path = os.path.join(docs_path, path)
    directory = os.path.dirname(path)
    if not os.path.exists(directory):
        os.makedirs(directory)

    with open(path, "w") as f:
        f.write(template.render(staticPath=static_folder_path, **kwargs))


collections_data = get_dummy_data("collections")
render("index.html", collections_template, data=collections_data)
