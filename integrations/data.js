const fs = require('fs')
const path = require('path')
const utilities = require('./utilities.js')

const actions = {
  async getCollectionResourceCount (collection) {
    const directory = path.join(process.cwd(), `/${collection}/collection/resource`)
    return fs.promises.readdir(directory).then(files => files.length).catch(error => {
      if (error) {
        return new Error(`Couldn't read directory: ${directory}`)
      }
    })
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

      week.forEach(day => {
        obj[day.toISOString().split('T')[0]] = { count: 0, tooltip: '' }
      })

      weeks.push(obj)
    }
    return weeks
  },
  async generateHeatmaps (history, tooltip) {
    const splitWeeks = actions.splitByWeek(actions.generateDays())

    const newResourceWeeks = splitWeeks.map(week => {
      Object.keys(week).map(day => {
        const runDay = history.find(run => run['date'] === day)

        const count = runDay ? runDay.new_resources.length : 0

        week[day] = {
          tooltip: `${count} new resources`,
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
  generateFailureReasons (failures, link) {
    const reasons = {}

    failures.forEach(failure => {
      const endpointUrl = link.find(entry => entry['link'] === failure['link']).url

      if (!Object.keys(reasons).includes(failure.status)) {
        reasons[failure.status] = []
      }

      reasons[failure.status].push({
        endpoint: endpointUrl, // get actual link
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
  async generateResourceHistory (log, link) {
    return [...new Set(log.map(entry => entry['resource']))].map(resource => {
      const thisResource = log.filter(entry => entry['resource'] === resource)

      const endpointUrl = link.find(entry => entry['link'] === thisResource[0]['link']).url

      return {
        resource: resource,
        new: resource,
        old: '',
        from: endpointUrl,
        first_appeared: thisResource.map(entry => entry['datetime'].split('T')[0]).sort((a, b) => a - b)[0]
      }
    })
  },
  async getCollectionLogHistory (collection) {
    const log = await utilities.csvToJSON(`${collection}/index/log.csv`)
    const link = await utilities.csvToJSON(`${collection}/index/link.csv`)
    const resourceHistory = await actions.generateResourceHistory(log, link)

    // Add date without to log - before looping through
    log.map(entry => {
      entry.date = entry['datetime'].split('T')[0]
      return entry
    })

    return [...new Set(log.map(entry => entry.date))].map(date => {
      const thisDay = log.filter(entry => entry['date'] === date)

      // Refactor below
      const endpointSuccess = thisDay.filter(entry => parseInt(entry['status']) === 200)
      const endpointFailures = thisDay.filter(entry => parseInt(entry['status']) !== 200)

      return {
        collection: collection.replace('-pipeline', ''),
        ran: true, // figure out what to do with this
        date: date,
        endpoints: {
          success: endpointSuccess.length,
          fail: endpointFailures.length,
          total_count: thisDay.length,
          last_updated: new Date().toISOString().split('T')[0], // need to get this from github,
          issues: actions.generateFailureReasons(endpointFailures, link)
        },
        // collection.json
        documentation_urls: {
          active: 0,
          inactive: 0
        },
        new_resources: resourceHistory.filter(entry => entry['first_appeared'] === date),
        issues: []
      }
    }).sort((a, b) => new Date(b.date) - new Date(a.date))
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
  const datasets = await utilities.csvToJSON('tmp/dataset.csv')
  const byCollection = await actions.generateCollectionsData(datasets)
  const byDate = await actions.splitByDate(byCollection)
  const dataPath = path.join(process.cwd(), '/data')

  await fs.promises.writeFile(`${dataPath}/by-collection.json`, JSON.stringify(byCollection, null, 2))
  await fs.promises.writeFile(`${dataPath}/by-date.json`, JSON.stringify(byDate, null, 2))
})()
