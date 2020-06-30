const csv = require('csv')
const fs = require('fs')
// const childProcess = require('child_process')

const actions = {
  csvToJSON (path) {
    const filename = process.cwd() + '/' + path
    const data = []

    if (fs.existsSync(filename)) {
      const stream = fs.createReadStream(filename).pipe(csv.parse({
        columns: true
      })).on('data', function (row) {
        data.push(row)
      })

      return new Promise((resolve, reject) => {
        stream.on('end', function () {
          return resolve(data)
        })
        stream.on('error', function (error) {
          return reject(error)
        })
      })
    } else {
      return []
    }
  },
  async getCollectionResourceCount (collection) {
    const files = await fs.promises.readdir(process.cwd() + '/' + collection + '/collection/resource').catch(function () {
      return []
    })
    return files.length
  },
  generateDays () {
    var dates = []
    var currentDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1))
    var addDays = function (days) {
      var date = new Date(this.valueOf())
      date.setDate(date.getDate() + days)
      return date
    }
    while (currentDate <= new Date()) {
      dates.push(currentDate)
      currentDate = addDays.call(currentDate, 1)
    }
    return dates
  },
  splitByWeek (array) {
    var weeks = []
    var size = 7
    for (var i = 0; i < array.length; i += size) {
      weeks.push(array.slice(i, i + size))
    }
    return weeks
  },
  async generateHeatmaps (history) {
    const newResourceWeeks = actions.generateDays().map(function (date) {
      var parsed = new Date(date).toISOString().split('T')[0]

      return {
        [parsed]: { count: 0, tooltip: 'x number of resources' }
      }
    })

    return {
      new_resources: {
        highest: Math.max.apply(Math, history.map(function (run) {
          return run.new_resources.length
        })),
        weeks: actions.splitByWeek(newResourceWeeks)
      },
      issues: {
        highest: 1,
        weeks: [
          {
            '2019-06-16': { count: 0, tooltip: 'x number of new resources' },
            '2019-06-17': { count: 1, tooltip: 'x number of new resources' },
            '2019-06-18': { count: 0, tooltip: 'x number of new resources' },
            '2019-06-19': { count: 0, tooltip: 'x number of new resources' },
            '2019-06-20': { count: 2, tooltip: 'x number of new resources' },
            '2019-06-21': { count: 0, tooltip: 'x number of new resources' },
            '2019-06-22': { count: 0, tooltip: 'x number of new resources' }
          },
          {
            '2019-06-23': { count: 0, tooltip: 'x number of new resources' },
            '2019-06-24': { count: 0, tooltip: 'x number of new resources' },
            '2019-06-25': { count: 5, tooltip: 'x number of new resources' },
            '2019-06-26': { count: 0, tooltip: 'x number of new resources' },
            '2019-06-27': { count: 0, tooltip: 'x number of new resources' },
            '2019-06-28': { count: 0, tooltip: 'x number of new resources' },
            '2019-06-29': { count: 0, tooltip: 'x number of new resources' }
          }
        ]
      }
    }
  },
  async generateCollectionsData (datasets) {
    return {
      active_count: datasets.filter(function (dataset) {
        return !dataset['end-date']
      }).length,
      inactive_count: datasets.filter(function (dataset) {
        return dataset['end-date']
      }).length,
      total_count: datasets.length,
      collections: await Promise.all(datasets.map(async function (dataset) {
        const splitUrl = dataset.url.split('/')
        const slug = splitUrl[splitUrl.length - 1]
        const history = await actions.getCollectionLogHistory(slug)
        const firstRun = history.length ? history[history.length - 1] : {}
        const lastRun = history.length ? history[0] : {}

        return {
          collection: slug.replace('-pipeline', ''),
          name: dataset.name,
          active: !dataset['end-date'],
          repository: dataset.url,
          // Resources
          total_resource_count: await actions.getCollectionResourceCount(slug),
          // Runs
          total_runs: history.length, // this only works if it's run once a day
          first_run: firstRun,
          last_run: lastRun,
          history: history,
          // Endpoints
          endpoints: lastRun ? lastRun.endpoints : {},
          // Heatmaps
          heatmap: await actions.generateHeatmaps(history)
        }
      }))
    }
  },
  async getResourceHistory (log) {
    const resources = []

    log.forEach(function (entry) {
      if (!resources.includes(entry['resource'])) {
        resources.push(entry['resource'])
      }
    })

    return resources.map(function (item) {
      return {
        resource: item,
        first_appeared: log.filter(function (entry) {
          return entry['resource'] === item
        }).map(function (entry) {
          return entry['datetime'].split('T')[0]
        }).sort(function (a, b) {
          return new Date(a) - new Date(b)
        })[0]
      }
    })
  },
  async getCollectionLogHistory (collection) {
    const log = await actions.csvToJSON(collection + '/index/log.csv')
    const resourceHistory = await actions.getResourceHistory(log)
    const history = []
    const dates = []

    log.map(function (row) {
      row.date = row['datetime'].split('T')[0]

      if (!dates.includes(row.date)) {
        dates.push(row.date)
      }

      return row
    })

    dates.forEach(function (date) {
      const todayLog = log.filter(function (entry) {
        return entry['date'] === date
      })

      history.push({
        ran: true, // figure out what to do with this
        date: date,
        endpoints: {
          success: todayLog.filter(function (entry) {
            return parseInt(entry['status']) === 200
          }).length,
          fail: todayLog.filter(function (entry) {
            return parseInt(entry['status']) !== 200
          }).length,
          total_count: todayLog.length,
          last_updated: '2020-05-06' // need to get this from github
        },
        // collection.json
        documentation_urls: {
          active: 100,
          inactive: 100
        },
        new_resources: resourceHistory.filter(function (entry) {
          return entry['first_appeared'] === date
        }),
        issues: 0
      })
    })

    return history.sort(function (a, b) {
      return new Date(b.date) - new Date(a.date)
    })
  },
  async splitByDate (collections) {
    const dates = []

    collections.collections.forEach(function (collection) {
      collection.history.forEach(function (run) {
        if (!dates.includes(run.date)) {
          dates.push(run.date)
        }
      })
    })

    return dates.map(function (date) {
      const didRun = []
      // get item for each collection if it ran that day
      collections.collections.forEach(function (collection) {
        collection.history.forEach(function (run) {
          if (run.date === date) {
            run.name = collection['name']
            didRun.push(run)
          }
        })
      })

      return {
        date: date,
        collections: didRun
      }
    })
  }
};

(async function () {
  const datasets = await actions.csvToJSON('tmp/dataset.csv')
  const byCollection = await actions.generateCollectionsData(datasets)
  const byDate = await actions.splitByDate(byCollection)

  await fs.promises.writeFile(process.cwd() + '/data/by-collection.json', JSON.stringify(byCollection, null, 2))
  await fs.promises.writeFile(process.cwd() + '/data/by-date.json', JSON.stringify(byDate, null, 2))
})()
