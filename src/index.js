/** @namespace firebase_cache */
const firebase_cache = {
  RefStore: require('./refstore'),
  Ref: require('./ref'),
  Model: require('./model'),
  ModelTemplate: require('./ModelTemplate'),
  EventCounter: require('./utils/EventCounter')
}

module.exports = firebase_cache
