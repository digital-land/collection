init:
	pip install -r requirements.txt

render:
	python render.py

clean:
	rm -r docs/*