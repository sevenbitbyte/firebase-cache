"use strict";

const Joi = require('joi')
const Hoek = require('hoek')
const Lodash = require('lodash')
const EventEmitter = require('events')

const RefStore = require('./refstore')



/**
 * @class
 * @classdesc
 * @memberof  firebase_cache
 */
class Reference {
  /**
   *  Reference
   *  @constructor
   */
  constructor(options){
    console.log('ref - ' + options.path)

    const schema = Joi.object().keys({
      store: Joi.object().type(RefStore.constructor).required(),
      path: Joi.string().regex(new RegExp("^(.*/)")).required(),
      ref: Joi.any(),
      queryObj: Joi.any(),
      autoOff: Joi.boolean()
    })

    let optionResult = Joi.validate(options, schema)

    if(optionResult.error){ throw optionResult.error }

    this.store = options.store /** @property  {RefStore}  store`- Default RefStore */
    this.ref = options.ref
    this.path = options.path
    this.queryObj = options.queryObj
    this.autoOff = (options.autoOff != undefined && options.autoOff != null) ? options.autoOff : this.store.autoOff

    this._data = undefined
    this.error = undefined

     //! Client callbacks
    this.callbacks = {
      error: [],
      data: []
    }
    this.events = new EventEmitter()
    this.events.setMaxListeners(50)

    this.handlers = {
      value: false,
      child_added: false,
      child_removed: false,
      child_changed: false,
      child_moved: false
    }

    this.stats = {
      created : new Date(),
      lastRead : undefined,        //! Time data was delivered to a listener
      lastUpdateStart : undefined, //! Last time an update started
      lastUpdate : undefined,   //! Last time an update finished
      lastIdle: undefined,
      counters : {
        read: 0,
        save: 0
      }
    }
  }

  /**
   *  @callback  firebase_cache.Reference.ErrorCallback
   *  @param  {firebase_cache.Reference.ErrorEvent}  event
   */

  /**
   *  @callback  firebase_cache.Reference.DataCallback
   *  @param  {firebase_cache.Reference.DataEvent}  event
   */

  /**
   * @typedef  {Object}  firebase_cache.Reference.DataEvent
   * @property {firebase_cache.Reference}  ref - Reference event occured in
   * @property {String}  type - Origin of event
   * @property {Object}  args - Detailed change infromation
   * @property {firebase.database.Snapshot}  args.snapshot - Firebase snapshot
   */

   /**
    * @typedef  {Object}  firebase_cache.Reference.ErrorEvent
    * @property {firebase_cache.Reference}  ref - Reference event occured in
    * @property {Object}  error - Original error object
    */


  /**
   *  Clear all data and event handlers
   */
  purge(){
    console.error('purge - ' + this.path)

    for(let event in this.handlers){
      //Remove internal listeners
      if(this.handlers[event]){ this._disconnectHandler(event) }

      //Remove external listeners
      this.events.removeAllListeners(event)
    }

    this.store.purge(this.path)

    this._data = null
    this.ref = null
    this.store = null
    delete this.ref
    delete this.store
    delete this._data
  }

  _handle_error(error){
    this.error = error
    console.error('_handle_error - ' + this.path)
    console.error(this)
    this.events.emit('error', {error: error, ref: this})
  }

  _handle_on_value(snapshot){
    console.log('_handle_on_value - ' + this.path)

    this._data = snapshot.val()
    this.stats.lastUpdate = new Date()
    this.events.emit('data', {
      ref: this,
      type: 'value',
      args: {
        val: snapshot.val(),
        snapshot: snapshot
      }
    })
  }

  /*_handle_on_child_added(event, arg1, arg2){}
  _handle_on_child_removed(event, arg1, arg2){}
  _handle_on_child_changed(event, arg1, arg2){}
  _handle_on_child_moved(event, arg1, arg2){}*/


  /**
   *  Listen for an event
   *  @param  {string}          event
   *  @param  {firebase_cache.Reference.DataCallback|firebase_cache.Reference.ErrorCallback}        callback
   *  @returns  {callback}
   */
  on(event, callback){

    if(!this.callbacks[event]){ throw 'Unsupported event type[' + event + ']' }

    if(this.events.listeners(event).indexOf(callback) == -1){
      // Connect client to internal eventemitter
      this.events.on(event, callback)
    }

    if(event == 'data'){
      //! Connect internal handlers
      this._connectHandler('value')
      /*this._connectHandler('child_added')
      this._connectHandler('child_moved')
      this._connectHandler('child_changed')
      this._connectHandler('child_removed')*/
      this.stats.lastUpdateStart = new Date()
    }

    return callback //! @returns User supplied callback
  }

  /**
   *  Disable handler for an event
   *  @param  {string}          event
   *  @param  {firebase_cache.Reference.DataCallback|firebase_cache.Reference.ErrorCallback}        callback
   */
  off(event, callback){
    if(!this.callbacks[event]){ throw 'Unsupported event type[' + event + ']' }

    var idx = this.events.listeners(event).indexOf(callback)
    if(idx != -1){
      // disconnect client from internal eventemitter
      this.events.removeListener(event, callback)
    }

    if(event == 'data' && this.events.listenerCount(event) == 0 && this.autoOff){
      //! Connect internal handlers
      this._disconnectHandler('value')
      /*this._disconnectHandler('child_added')
      this._disconnectHandler('child_moved')
      this._disconnectHandler('child_changed')
      this._disconnectHandler('child_removed')*/
      this.stats.lastIdle = new Date()
    }
  }

  //! Connect internal handlers for
  _connectHandler(event){
    if(this.handlers[event]){ return }

    var handler = Hoek.reach(this, '_handle_on_'+event)
    this.ref.on(event, handler, this._handle_error.bind(this), this)
    this.handlers[event]=true
  }

  _disconnectHandler(event){
    if(!this.handlers[event]){ return }

    var handler = Hoek.reach(this, '_handle_on_'+event)
    this.ref.off(event, handler, this)
    this.handlers[event]=false
  }

  /**
   *  Wait for a single update from firebase
   *  @param  {string}  event - An event to wait for. Can be `data` or `error`
   *  @param  {firebase_cache.Reference.DataCallback|firebase_cache.Reference.ErrorCallback}        callback
   */
  once(event, func){
    this.on(event, ()=>{
      this.off(event, func)
    })

    this.on(event, func)
  }

  /**
   *  Returns data currently available from cache
   *  @returns {Object}
   */
  val(){
    if(this._data){
      this.stats.counters.read++
      this.stats.lastRead = new Date()
      return this._data
    }
    return null
  }

  /**
   *  Delivers data immediatly if cached or as soon as its avilable
   *  @param  {firebase_cache.Reference.DataCallback}        callback
   *  @param  {firebase_cache.Reference.ErrorCallback}        errorCallback
   */
  data(callback, errorCallback){
    if(this._data){
      setTimeout(()=>{
        callback({
          ref: this,
          type: 'cache'
        })
      }, 0)

      return
    }

    this.once('data', callback)
    this.once('error', errorCallback)
    this.once('data', ()=>{
      this.off('error', errorCallback)
    })
  }

  push(){

  }

  /**
   *  Create a query which selects previous items
   *  @returns  {firebase_cache.Reference}
   */
  prev(){
    if(Hoek.reach(this.queryObj, 'orderBy', {default: '$key'}) == '$key'){
      let keys = Object.keys(this._data)
      if(keys.length > 0){
        let prevQueryObj = {
          endAt: keys[0],
          limitToLast: Hoek.reach(this.queryObj, 'limitToLast', {default: 25})
        }

        return this.store.query(this.path, nextQueryObj)
      }
    }
    else if(Hoek.reach(this.queryObj, 'orderBy') == '$value'){

    }
    else if(Hoek.reach(this.queryObj, 'orderBy') == '$priority'){

    }
    else if(typeof Hoek.reach(this.queryObj, 'orderBy') === 'string'){
      let prevQueryObj = {
        endAt: this._data[0][this.queryObj.orderBy],
        orderBy: this.queryObj.orderBy,
        limitToLast: Hoek.reach(this.queryObj, 'limitToLast', {default: 25})
      }

      return this.store.query(this.path, nextQueryObj)
    }
  }

  /**
   *  Create a query which selects next items
   *  @returns  {firebase_cache.Reference}
   */
  next(){
    console.log(this)
    if(Hoek.reach(this.queryObj, 'orderBy') == '$key'){
      let keys = Object.keys(this._data)
      if(keys.length > 0){
        let lastKey = keys[keys.length - 1]
        let nextQueryObj = {
          orderBy: '$key',
          startAt: lastKey,
          limitToFirst: Hoek.reach(this.queryObj, 'limitToFirst', {default: 25})
        }

        return this.store.query(this.path, nextQueryObj)
      }
    }
  }
}

module.exports = Reference
