const csv = require('csv')
const fs = require('fs')
const path = require('path')

module.exports = {
  csvToJSON (file) {
    const filename = path.join(process.cwd(), file)
    const data = []

    return new Promise((resolve, reject) => {
      if (fs.existsSync(filename)) {
        fs.createReadStream(filename).pipe(csv.parse({
          columns: true
        })).on('data', row => {
          return data.push(row)
        }).on('end', () => {
          return resolve(data)
        }).on('error', error => {
          return reject(error)
        })
      } else {
        return reject(new Error('No file exists.'))
      }
    })
  }
}
