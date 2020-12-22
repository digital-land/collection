all: clean fetch render

init:
	pip install -r requirements.txt
	npm install

fetch:
	node integrations/data.js

render:
	python render.py

clean:
	rm -r docs/*

collect:
	mkdir -p collections/conservation-area-collection
	curl https://codeload.github.com/digital-land/conservation-area-collection/tar.gz/main | tar -xz --strip=2 -C collections/conservation-area-collection conservation-area-collection-main/collection

	mkdir -p collections/brownfield-land-collection
	curl https://codeload.github.com/digital-land/brownfield-land-collection/tar.gz/main | tar -xz --strip=2 -C collections/brownfield-land-collection brownfield-land-collection-main/collection
