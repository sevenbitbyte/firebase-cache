'use strict';

const Joi = require('joi')
const Url = require('url')
const Hoek = require('hoek')


const Ref = require('./ref')

/**
 * @class
 * @classdesc
 * @memberof  firebase_cache
 */
class RefStore {

  /**
   *  RefStore
   *  @constructor
   *  @param  {firebase}  firebaseInstance  - Firebase
   *  @param  {boolean}   autoOff - If enabled, all queries and refs created by this store will stop listening for data updates after the last client disconnects. If false refs and queries will cache updates when no one is listening.
   */
  constructor(firebaseInstance, autoOff){
    this.autoOff = (autoOff!=undefined) ? autoOff : true
    this.firebase = firebaseInstance
    this.refs = {}          //! Map of [refPath] -> Ref
    this.nativeRefs = {}    //! Map of [refPath] -> firebase.Database.Reference
    this.queries = {}       //! Map of [queryPath] -> firebase.Database.Query
    this.nativeQueries = {} //! Map of [queryPath] -> firebase.Database.Query
  }


  /**
   *  Create or return a Ref instance for the specified path
   *  @param  {string}  path
   *  @returns {firebase_cache.Ref}
   */
  ref(path){
    let url = Url.parse(path, true)
    let refPath = url.pathname

    if(url.query && Object.keys(url.query).length > 0){
      //passed in a query
      return this.query(refPath, url.query)
    }

    if(this.hasRef(refPath)){ return this.refs[refPath] }

    this.nativeRefs[refPath] = this.firebase.database().ref(refPath)
    this.refs[refPath] = new Ref({store: this, path: refPath, ref: this.nativeRefs[refPath]})
    return this.refs[refPath]
  }


  /**
   *  Create or return a Ref instance for the specified query path
   *  @param  {string}  path
   *  @param  {firebase_cache.RefStore.QueryConfig}  query - Query Object
   *  @returns {firebase_cache.Ref}
   */
  query(path, query){
    console.log('query')
    let url = Url.parse(path, true)
    let queryObj = RefStore.parseQueryPath(path, query)
    let queryString = RefStore.queryToQueryString(url, queryObj)

    // Return existing query
    if(this.hasQuery(url, queryObj)){ return this.queries[queryString] }

    var fbQuery = this.nativeQuery(path, queryObj)
    this.queries[queryString] = new Ref({store: this, path: queryString, ref:fbQuery, queryObj: queryObj})
    return this.queries[queryString]
  }

  /**
   *  Clean up resources associated with the specified ref or query. Purge should be called on the ref/query directly first
   *  @param  {string}  path  - Ref or query path
   */
  purge(path){
    if(this.hasQuery(path)){
      this.queries[path] = null
      this.nativeQueries[path] = null

      delete this.queries[path]
      delete this.nativeQueries[path]
    }

    if(this.hasRef(path)){
      this.refs[path] = null
      this.nativeRefs[path] = null

      delete this.refs[path]
      delete this.nativeRefs[path]
    }
  }

  /**
   *  Lookup a firebase Reference from those tracked by the store. Returns a newly created Reference if not already tracked
   *  @param  {string}  path  - Ref path
   *  @returns {firebase.Database.Reference}
   */
  nativeRef(path){
    let url = Url.parse(path, true)
    let refPath = url.pathname

    if(!path || path.length < 1){ refPath = '/'; console.log('root request') }


    // Handle queries
    if(url.query && Object.keys(url.query).length > 0){
      return this.nativeQuery(refPath, url.query)
    }

    if(this.nativeRefs[refPath]){ return this.nativeRefs[refPath] }

    this.nativeRefs[refPath] = this.firebase.database().ref(refPath)
    if(this.nativeRefs[refPath] == null){ throw 'WTF?' }
    return this.nativeRefs[refPath];
  }

  static parseQueryPath(path, query){
    let url = Url.parse(path, true)
    let queryObj = (query)?query : url.query

    var schema = Joi.object().keys({
      orderBy: Joi.string(),
      limitToFirst: Joi.number().integer().max(200),
      limitToLast: Joi.number().integer().max(200),
      startAt: Joi.alternatives().try(
        Joi.string(),
        Joi.object().keys({
          value: Joi.string(),
          key: Joi.string()
        })
      ),
      endAt: Joi.string(),
      equalTo: Joi.string()
    }).nand('limitToFirst', 'limitToLast')

    //Is the query object valid
    let params = Joi.validate(queryObj, schema)
    queryObj = params.value;


    if(params.error){ console.log(params); console.log(query); throw params.error }

    //! NOTE: Defaults to limitToFirst 25 items
    if(!queryObj.limitToLast && !queryObj.limitToFirst){ queryObj.limitToFirst = 25 }

    return queryObj
  }

  static queryToQueryString(url, queryObj){
    let queryString = Url.format({
      pathname: url.pathname,
      query: (queryObj) ? queryObj : url.query
    })

    //NOTE: Special case for serializing complex startAt queries
    /*if(queryObj && queryObj.startAt && Object.keys(queryObj.startAt).length > 0){
      queryString += '&startAt=(' + queryObj.startAt.key + ',' + queryObj.startAt.value + ')'
      console.log('startAt')
    }*/

    var idxStartAt = queryString.indexOf('startAt=&')
    if(idxStartAt != -1){
      console.log(idxStartAt)
      var len = 'startAt='.length
      var value = encodeURIComponent('(' + queryObj.startAt.key + ',' + queryObj.startAt.value + ')')
      queryString = queryString.slice(0, idxStartAt+len) + value + queryString.slice(idxStartAt+len)
      console.log('startAt')
    }

    return queryString
  }


  /**
   * @typedef  {Object}  firebase_cache.RefStore.QueryConfig
   * @property {Number}  limitToFirst - Return up to limit items from the front
   * @property {Number}  limitToLast - Return up to limit items from the back
   * @property {string}  orderBy - Special values are $key, $priority, $value
   * @property {Object}  equalTo
   * @property {string}  equalTo.key
   * @property {string}  equalTo.value
   * @property {Object}  startAt
   * @property {string}  startAt.key
   * @property {string}  startAt.value
   * @property {Object}  endAt
   * @property {string}  endAt.key
   * @property {string}  endAt.value
   */

  /**
   *  Lookup a firebase Query from those tracked by the store. Returns a newly created Reference if not already tracked
   *  @param  {string}  path  - Query path
   *  @param  {firebase_cache.RefStore.QueryConfig}  query - Query Object
   *  @returns {firebase.Database.Query}
   */
  nativeQuery(path, query){
    let url = Url.parse(path, true)
    var queryObj = RefStore.parseQueryPath(path, query)
    let queryString = RefStore.queryToQueryString(url, queryObj)

    // Return existing query
    if(this.nativeQueries[queryString]){ return this.nativeQueries[queryString] }

    //Build firebase.database.Query from firebase.database.Reference
    //var ref = this.nativeRef(url.pathname)
    var ref = this.firebase.database().ref(url.pathname)

    console.log(queryString)

    for(let op in queryObj){
      let param = queryObj[op]
      switch(op){
        case 'orderBy':
          console.log('orderBy')
          console.log(param)
          if(param == '$key'){ ref = ref.orderByKey() }
          else if(param == '$priority'){ ref = ref.orderByPriority() }
          else if(param == '$value'){ ref = ref.orderByValue() }
          else { ref = ref.orderByChild(param) }
          break
        case 'limitToFirst':
          ref = ref.limitToFirst(param)
          break
        case 'limitToLast':
          ref = ref.limitToLast(param)
          break
        case 'startAt':
          console.log('startAt')
          console.log(param)
          if(typeof param == 'string'){ ref = ref.startAt(param) }
          else{ ref = ref.startAt(param.value, param.key) }
          break
        case 'endAt':
          if(typeof param == 'string'){ ref = ref.endAt(param) }
          else{ ref = ref.endAt(param.value, param.key) }
          break
        case 'equalTo':
          ref = ref.equalTo(param.value, param.key)
          break
        default:
          throw 'Invalid query operation['+op+']'
      }
    }


    this.nativeQueries[queryString] = ref
    return this.nativeQueries[queryString]
  }

  /**
   *  Is the specified Reference currently tracked
   *  @param  {string}  path
   *  @returns {boolean}
   */
  hasRef(path){
    let url = Url.parse(path, true)
    let refPath = url.pathname

    return this.refs[refPath] && this.refs[refPath] instanceof Ref
  }

  /**
   *  Is the specified Query currently tracked
   *  @param  {string}  path
   *  @param  {firebase_cache.RefStore.QueryConfig}  query - Query Object
   *  @returns {boolean}
   */
  hasQuery(path, query){
    let url = Url.parse(path, true)
    let queryObj = RefStore.parseQueryPath(path, query)
    let queryString = RefStore.queryToQueryString(url, queryObj)

    return this.queries[queryString] && this.queries[queryString] instanceof Ref
  }


}

module.exports = RefStore
