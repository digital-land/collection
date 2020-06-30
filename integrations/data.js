const csv = require('csv')
const fs = require('fs')

const actions = {
  csvToJSON (path) {
    const filename = `${process.cwd()}/${path}`
    const data = []

    if (fs.existsSync(filename)) {
      const stream = fs.createReadStream(filename).pipe(csv.parse({
        columns: true
      })).on('data', row => {
        data.push(row)
      })

      return new Promise((resolve, reject) => {
        stream.on('end', () => resolve(data))
        stream.on('error', error => reject(error))
      })
    } else {
      return []
    }
  },
  async getCollectionResourceCount (collection) {
    const files = await fs.promises.readdir(`${process.cwd()}/${collection}/collection/resource`).catch(() => [])
    return files.length
  },
  generateDays () {
    const dates = []
    let currentDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1))
    const addDays = function (days) {
      const date = new Date(this.valueOf())
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
    const weeks = []
    const size = 7
    for (let i = 0; i < array.length; i += size) {
      const week = array.slice(i, i + size)
      const obj = {}

      week.forEach(function (day) {
        obj[day.toISOString().split('T')[0]] = { count: 0, tooltip: '' }
      })

      weeks.push(obj)
    }
    return weeks
  },
  async generateHeatmaps (history, tooltip) {
    const splitWeeks = actions.splitByWeek(actions.generateDays())

    const newResourceWeeks = splitWeeks.map(function (week) {
      Object.keys(week).map(function (day) {
        const runDay = history.find(function (run) {
          return run['date'] === day
        })

        var count = runDay ? runDay.new_resources.length : 0

        week[day] = {
          tooltip: count + ' new resources',
          count: count
        }
      })

      return week
    })

    const issuesWeeks = splitWeeks

    return {
      new_resources: {
        highest: Math.max.apply(Math, history.map(run => run.new_resources.length)),
        weeks: newResourceWeeks
      },
      issues: {
        highest: Math.max.apply(Math, history.map(run => run.issues.length)),
        weeks: issuesWeeks
      }
    }
  },
  generateFailureReasons (failures) {
    const reasons = {}

    failures.forEach(function (failure) {
      if (!Object.keys(reasons).includes(failure.status)) {
        reasons[failure.status] = []
      }

      reasons[failure.status].push({
        endpoint: failure.link, // get actual link
        documentation_url: '' // dunno what to do with this
      })
    })

    return reasons
  },
  async generateCollectionsData (datasets) {
    return {
      active_count: datasets.filter(dataset => !dataset['end-date']).length,
      inactive_count: datasets.filter(dataset => dataset['end-date']).length,
      total_count: datasets.length,
      collections: await Promise.all(datasets.map(async dataset => {
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

    log.forEach(entry => {
      if (!resources.includes(entry['resource'])) {
        resources.push(entry['resource'])
      }
    })

    return resources.map(item => ({
      resource: item,
      new: item,
      old: '', // need to fill out
      from: '', // need to fill out
      first_appeared: log.filter(entry => entry['resource'] === item).map(entry => entry['datetime'].split('T')[0]).sort((a, b) => new Date(a) - new Date(b))[0]
    }))
  },
  async getCollectionLogHistory (collection) {
    const log = await actions.csvToJSON(`${collection}/index/log.csv`)
    const resourceHistory = await actions.getResourceHistory(log)
    const history = []
    const dates = []

    log.map(row => {
      row.date = row['datetime'].split('T')[0]

      if (!dates.includes(row.date)) {
        dates.push(row.date)
      }

      return row
    })

    dates.forEach(date => {
      const todayLog = log.filter(entry => entry['date'] === date)
      const endpointFailures = todayLog.filter(entry => parseInt(entry['status']) !== 200)

      history.push({
        collection: collection.replace('-pipeline', ''),
        ran: true, // figure out what to do with this
        date: date,
        endpoints: {
          success: todayLog.filter(entry => parseInt(entry['status']) === 200).length,
          fail: endpointFailures.length,
          total_count: todayLog.length,
          last_updated: new Date().toISOString().split('T')[0], // need to get this from github,
          issues: actions.generateFailureReasons(endpointFailures)
        },
        // collection.json
        documentation_urls: {
          active: 0,
          inactive: 0
        },
        new_resources: resourceHistory.filter(entry => entry['first_appeared'] === date),
        issues: []
      })
    })

    return history.sort((a, b) => new Date(b.date) - new Date(a.date))
  },
  async splitByDate (collections) {
    const dates = []

    collections.collections.forEach(collection => {
      collection.history.forEach(run => {
        if (!dates.includes(run.date)) {
          dates.push(run.date)
        }
      })
    })

    return dates.map(date => {
      const didRun = []
      // get item for each collection if it ran that day
      collections.collections.forEach(collection => {
        collection.history.forEach(run => {
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

(async () => {
  const datasets = await actions.csvToJSON('tmp/dataset.csv')
  const byCollection = await actions.generateCollectionsData(datasets)
  const byDate = await actions.splitByDate(byCollection)

  await fs.promises.writeFile(`${process.cwd()}/data/by-collection.json`, JSON.stringify(byCollection, null, 2))
  await fs.promises.writeFile(`${process.cwd()}/data/by-date.json`, JSON.stringify(byDate, null, 2))
})()
