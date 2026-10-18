'use strict'

// Generates the benchmark datasets used by ./bench.js and ./stream.js. The
// shapes are representative of real-world payloads: string-heavy nested objects,
// small documents, and a large primitive-heavy array. Generation is
// deterministic so results are comparable across runs.

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')

// A string-heavy document loosely modelled on a MongoDB-style record. ~70% of
// the leaf values are strings and lengths vary, so the native UTF-8 paths are
// exercised heavily.
function makeLargeDoc (i) {
  const name = 'record-' + i
  return {
    _id: '56490c18d9275a000300' + String(1000 + i).slice(1),
    author: i % 5 === 0 ? null : 'user-' + (i % 7),
    created_at: '2015-11-15T22:' + String(i % 60).padStart(2, '0') + ':00.000Z',
    description: 'A weekly discussion by developers about programming, life, and a long tail of topics. Post #' + i + '.',
    title: 'Discussion #' + i + ' \u2014 a fairly descriptive title that scales with length ' + 'x'.repeat(i % 24),
    url: 'https://example.com/discussions/' + i,
    score: 10 + (i % 90),
    views: (i * 137) % 100000,
    tags: ['one', 'two', 'three', 'four', 'five'].slice(0, (i % 5) + 1),
    comments: i % 3 === 0 ? [] : [{ id: i, text: 'Nice post about ' + name + ' ' + 'y'.repeat(i % 12) }],
    pinned: i % 7 === 0
  }
}

function generateSampleLarge () {
  const arr = []
  for (let i = 0; i < 40; i++) arr.push(makeLargeDoc(i))
  return arr
}

// A small, shallow object with a mix of primitive types.
function generateExample5 () {
  return {
    greeting: 'Hello, World!',
    n: 42,
    ratio: 0.618,
    flag: true,
    nothing: null,
    arr: [1, 2, 3, 4, 5],
    nested: { a: true, b: null, c: 'x'.repeat(64) },
    tag: 'example'
  }
}

// A nested object with medium-length strings, roughly a clinical-trial record.
function generateExample4 () {
  const trials = []
  for (let i = 0; i < 24; i++) {
    trials.push({
      metadata: {
        title: 'A randomized controlled trial for intervention ' + i + ' with a long descriptive name',
        registration: 'NCT' + (10000000 + i),
        phase: ['I', 'II', 'III', 'IV'][i % 4],
        status: ['completed', 'recruiting', 'active'][i % 3],
        primary_outcome: 'Change from baseline in the primary endpoint at week ' + (i % 52),
        sponsors: ['Pharma Inc', 'Biotech Ltd', 'University ' + (i % 5)].slice(0, (i % 3) + 1)
      },
      enrollment: { count: 100 + i * 7, sites: (i % 20) + 1, duration_months: 6 + (i % 12) },
      endpoints: [
        { name: 'primary', description: 'A long description of the primary endpoint for trial ' + i },
        { name: 'secondary', description: 'Secondary endpoint ' + i + ' with ' + 's'.repeat(i % 16) }
      ],
      results: null
    })
  }
  return { version: '2.0', trials }
}

// A large, primitive-heavy array of mixed-width values and short strings.
function makeMixedRecord (i) {
  return {
    id: i,
    active: i % 2 === 0,
    score: i * 1.5,
    ratio: (i % 100) / 7,
    name: 'patient-' + String(10000 + i).slice(1),
    diagnosis: ['none', 'mild', 'severe', 'critical'][i % 4],
    notes: i % 3 === 0 ? null : 'A moderately long clinical note for record #' + i + ' with some detail.',
    flags: [i, i + 1, i + 2],
    metrics: { sys: 120 + (i % 40), dia: 80 + (i % 20), pulse: 60 + (i % 40), temp: 36.5 + (i % 10) / 2 },
    tag: i > 10 ? undefined : 'early'
  }
}

function generateMixed () {
  const arr = []
  for (let i = 0; i < 500; i++) arr.push(makeMixedRecord(i))
  return arr
}

const generators = {
  'sample-large.json': generateSampleLarge,
  'example4.json': generateExample4,
  'example5.json': generateExample5,
  'mixed.json': generateMixed
}

function ensureData (dir) {
  dir = dir || DATA_DIR
  fs.mkdirSync(dir, { recursive: true })
  for (const name of Object.keys(generators)) {
    const file = path.join(dir, name)
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(generators[name]()))
    }
  }
  return dir
}

if (require.main === module) {
  const dir = ensureData()
  console.log('generated datasets in', dir)
  for (const name of Object.keys(generators)) {
    const size = fs.statSync(path.join(dir, name)).size
    console.log('  ' + name + ' (' + size + ' bytes)')
  }
}

module.exports = { ensureData, generators, DATA_DIR }
