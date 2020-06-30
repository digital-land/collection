all: clean fetch render

init:
	pip install -r requirements.txt

fetch:
	node integrations/data.js

render:
	python render.py

clean:
	rm -r docs/*
