const express = require('express')
const path = require('path')
const app = express()
const port = process.env.PORT || 8080

app.use('/collection', express.static(path.join(__dirname, 'docs')))
app.listen(port)
console.log('collection has been built to http://localhost:' + port + '/collection')
