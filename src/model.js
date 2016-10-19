'use strict'

const Hoek = require('hoek')
const Async = require('async')
const Lodash = require('lodash')
const EventEmitter = require('events')

/**
 * @class
 * @classdesc
 * @memberof  firebase_cache
 */
class Model {
  /**
   *  Model
   *  @constructor
   */
  constructor(name, store){
    this.store = store
    this.fields = {}
    this.templates = {}
    this.params = {}  //! Map of params[ 'profileID' ] = -K-A4F3GDGF5F4dvtHrt5r etc
    this.events = new EventEmitter()
    this.events.setMaxListeners(100)
    this.path = 'model://'+name

    this.events = new EventEmitter()
  }


  /**
   *  @typedef  {Object}  firebase_cache.Model.Field
   *  @property {string}  name - Field name
   *  @property {firebase_cache.Ref|firebase_cache.Model}  source - Origin of data
   *  @property {string}  path -  Firebase ref path or model path
   *  @property {string}  type  - Update type (on, once, val, data, or offline)
   *  @property {object}  data  - Last read data object
   *  @property {string}  datatype  - Last read data source event type
   *  @property {boolean} handler   - Data ready event handler
   *  @property {Date}  lastUpdate  - Last update time
   */


   /**
    *  @callback  firebase_cache.Model.ErrorCallback
    *  @param  {firebase_cache.Model.ErrorEvent}  event
    */

   /**
    *  @callback  firebase_cache.Model.DataCallback
    *  @param  {firebase_cache.Model.DataEvent}  event
    */

   /**
    * @typedef  {Object}  firebase_cache.Model.DataEvent
    * @property {firebase_cache.Model}  model - Model event occured in
    * @property {string}  field - Field of event origin
    * @property {string}  type - Data update type
    */

    /**
     * @typedef  {Object}  firebase_cache.Model.ErrorEvent
     * @property {firebase_cache.Model}  model - Model event occured in
     * @property {string}  field - Field of event origin
     * @property {Object}  error - Original error object
     */

  /**
   *  Set a reference or model as a field
   *
   *  @param  {string}  name - Field name
   *  @param  {firebase_cache.Ref|firebase_cache.Model} refOrModel - reference or model to use the field's source of data
   *  @param  {string}  type - Type defines how data is updated for this field. Accepted values are on, once, val, data or offline
   */
  createField(name, refOrModel, type){
    let f = this.fields[name]
    let alreadyConnected=f && f.handler
    let connectedEvents = (f) ? Object.keys(f.handler) : []

    let newField = {
      name: name,
      source: refOrModel,
      path: refOrModel.path,
      type: (type) ? type : Hoek.reach(oldField, 'type', {default: 'data'}),
      data: (refOrModel.val()) ? refOrModel.val() : null,
      datatype: null,
      handler: {},
      lastUpdate: undefined
    }

    //validate type
    switch(newField.type){
      case 'on':
      case 'once':
      case 'data':
      case 'val':
      case 'offline':
        break
      default:
        throw 'Invalid field type[' + newField.type + ']'
    }

    this.fields[name] = newField

    if(alreadyConnected){
      for(let i in connectedEvents){
          this._disconnectHandler(connectedEvents[i], f)
      }

      if(f.source && f.type == 'on' && newField.type == 'on'){
        for(let i in connectedEvents){
            this._connectHandler(connectedEvents[i], this.fields[name])
        }
      }
    }
  }

  createTemplate(name, template){
    this.templates[name] = template
    return this.updateTemplate(name)
  }

  updateTemplate(name){
    //! Create a new source using template and params

    let f = this.field(name)
    let t = this.templates[t].template
    let newSettings = t.applyParams(this.params)

    if(newSettings.query){
      if(!f || JSON.stringify(f.ref.queryObj) != JSON.stringify(newSettings.query)){
        let newQuery = this.store.query(newSettings.uri, newSettings.query)
        this.createField(name, query, Hoek.reach(f, 'type'))
        return true
      }
    }
    else if(!f || newSettings.uri != f.path){
      let newRef = this.store.ref(newSettings.uri)
      this.createField(name, ref, Hoek.reach(f, 'type'))
      return true
    }
    return false
  }

  /**
   *  Remove a fields
   *
   *  @param  {string}  name  - Field name
   */
  removeField(name){
    //disconnect callbacks
    let f = this.fields[name]
    let alreadyConnected=f && f.handler
    let connectedEvents = (f) ? Object.keys(f.handler) : []
    if(alreadyConnected){
      for(let i in connectedEvents){
          this._disconnectHandler(connectedEvents[i], f)
      }
    }
    this.fields[name] = null
    delete this.fields[name]
  }

  /**
   *  Get Field by name
   *  @param  {string}  name  - Field name
   *  @returns  {firebase_cache.Model.Field}
   */
  field(name){
    return this.fields[name]
  }

  /**
   *  Get Field by source object
   *  @param  {firebase_cache.Ref|firebase_cache.Model}  source  - Field source
   *  @returns  {firebase_cache.Model.Field}
   */
  fieldBySource(source){
    return Lodash.find(this.fields, (value, index)=>{
      return (value.source == source)
    })
  }

  _handle_error(error){
    //this.events.emit('error', error)
  }

  _handle_on_data(event){
    console.log('model._handle_on_data')
    console.log(event)
    let f = this.fieldBySource(event.ref)

    f.data = event.ref.val()
    f.datatype = event.type
    f.lastUpdate = new Date()

    if(f.type == 'offline'){
      // Don't update offline data fields
      return
    }

    if(f.handler['data'] && f.type == 'data'){
      f.handler['data']=false
    }

    this.events.emit('data.'+f.name, {
      model: this,
      field: f.name,
      type: f.datatype
    })

    this.events.emit('data', {
      model: this,
      field: f.name,
      type: f.datatype
    })
  }

  _handle_on_error(error){
    console.error(error)
    var fieldName = Hoek.reach(this.fieldBySource(event.ref), 'name')
    if(fieldName){ this.error[fieldName] = error.error }

    if(f.handler['data'] && f.type == 'data'){
      f.handler['data']=false
    }

    this.events.emit('error' + ((fieldName) ? '.'+fieldName : ''), {
      model: this,
      field: fieldName,
      error: error.error
    })
  }


  /**
   *  Prepare model and underlying fields object for garbage collection
   */
  purge(){
    for(let name in this.fields){
      let f = this.fields[name]
      if(f.source){
        this._disconnectHandler('data', f)
        this._disconnectHandler('error', f)
        f.source.purge()

        f.source = null
        delete f.source
      }
    }
  }

  /**
   *  Listen for an event
   *  @param  {string}          event
   *  @param  {firebase_cache.Model.DataCallback|firebase_cache.Model.ErrorCallback}        callback
   *  @returns  {callback}
   */
  on(event, callback){
    let eventTokens = event.split('.')

    if(eventTokens[0] != 'data' && eventTokens[0] != 'error'){
      throw 'Unsupported event type[' + event + ']'
    }

    if(this.events.listeners(event).indexOf(callback) == -1){
      // Callback not already attached
      this.events.on(event, callback)
    }

    var f;

    var __connectField = function(f){
      if(f.source && f.type == 'on'){
        this._connectHandler(eventTokens[0], f)
      }
      else if(f.source && f.type == 'once' && !f.data){
        var handler = Hoek.reach(this, '_handle_on_'+eventTokens[0])
        f.source.once(eventTokens[0], handler, this._handle_error.bind(this), this)
      }
      else if(f.source && eventTokens[0]=='data' && f.type == 'data' && !f.data){
        this._connectDataHandler(eventTokens[0], f)
      }
      else if(f.source && eventTokens[0]=='data' && f.type == 'val' && !f.data){
        setTimeout(()=>{
          this._handle_on_data({
            ref: f.source,
            type: 'cache'
          })
        })
      }
    }

    if(eventTokens.length > 1 && eventTokens[1] != '*'){
      __connectField(this.field(eventTokens[1]))
    }
    else{
      //Ensure all fields in default listen modes

      for(let name in this.fields){
        __connectField(this.fields[name])
      }
    }
  }

  _connectHandler(event, f){
    if(f.handler[event]){ return }

    var handler = Hoek.reach(this, '_handle_on_'+event)
    f.source.on(event, handler, this._handle_error.bind(this), this)
    f.handler[event]=true
  }

  _connectDataHandler(event, f){
    console.log('_connectDataHandler - ' + event)
    if(f.handler[event]){ return; console.log('pass')}

    f.source.data(this._handle_on_data.bind(this), this._handle_error.bind(this))
    f.handler[event]=true
  }

  _disconnectHandler(event, f){
    if(!f.handler[event]){ return }

    var handler = Hoek.reach(this, '_handle_on_'+event)
    f.source.off(event, handler, this)
    f.handler[event]=false
  }

  /**
   *  Disable handler for an event
   *  @param  {string}          event
   *  @param  {firebase_cache.Model.DataCallback|firebase_cache.Model.ErrorCallback}        callback
   */
  off(event, callback){

    let eventTokens = event.split('.')

    if(eventTokens[0] != 'data' && eventTokens[0] != 'error'){
      throw 'Unsupported event type[' + event + ']'
    }

    if(this.events.listeners(event).indexOf(callback) != -1){
      // Detach client callback
      this.events.removeListener(event, callback)
    }

    if(eventTokens.length > 1 && eventTokens[1] != '*'){
      var f = this.field(eventTokens[1])

      if(f.source && f.type == 'on'){

        let listenerCount = Math.max(
          this.events.listenerCount(event),
          this.events.listenerCount(eventTokens[0])
        )

        if(listenerCount < 1){
          console.log('handler cleanup ' + event)
          this._disconnectHandler(eventTokens[0], f)
        }
      }
    }
    else{
      for(let name in this.fields){
        let f = this.fields[name]

        if(f.source && f.type == 'on'){
          let listenerCount = Math.max(
            this.events.listenerCount(event),
            this.events.listenerCount(eventTokens[0])
          )

          if(listenerCount < 1){
            console.log('handler cleanup ' + event)
            this._disconnectHandler(eventTokens[0], f)
          }
        }
      }
    }
  }

  /**
   *  Wait for a single update from firebase
   *  @param  {string}  event - An event to wait for. Can be `data.<field>` or `error.<field>` where field is optional
   *  @param  {firebase_cache.Model.DataCallback|firebase_cache.Model.ErrorCallback}        callback
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
    var obj = {}

    for(let name in this.fields){
      let f = this.fields[name]

      obj[name] = f.data
    }

    return obj;
  }

  /**
   *  Delivers data immediatly if cached or as soon as its avilable
   *  @param  {firebase_cache.Model.DataCallback}        callback
   *  @param  {firebase_cache.Model.ErrorCallback}        errorCallback
   */
  data(callback, errorCallback){
    var updateQueue = []
    for(let name in this.fields){
      if(!this.fields[name].data && this.fields[name].type != 'offline'){
        updateQueue.push(this.fields[name]) //request data
      }
    }

    if(updateQueue.length < 1){
      console.log('no diff')
      setTimeout(()=>{
        callback({
          model: this,
          field: '',
          type: 'cache'
        })
      }, 0)

      return
    }
    else{

      console.log('model.once')

      this.once('data', callback)
      this.once('error', errorCallback)
      this.once('data', ()=>{
        this.off('error', errorCallback)
      })

      return
    }
  }

  /**
   *  Create a query which selects previous items
   *  @param  {string}  name - Field name
   *  @returns  {firebase_cache.Ref}
   */
  prev(name){
    let f = this.field(name)
    let newSource = f.source.prev()
    this.createField(name, newSource, f.type)
    f = this.field(name)

    if(f.source && f.type == 'once' && !f.data){
      var handler = Hoek.reach(this, '_handle_on_'+eventTokens[0])
      f.source.once('data', handler, this._handle_error.bind(this), this)
    }
    else if(f.source && f.type == 'data' && !f.data){
      f.source.data(this._handle_on_data.bind(this), this._handle_error.bind(this))
    }
    else if(f.source && f.type == 'val' && !f.data){
      setTimeout(()=>{
        this._handle_on_data({
          ref: f.source,
          type: 'cache'
        })
      })
    }
  }

  /**
   *  Create a query which selects next items
   *  @param  {string}  name - Field name
   *  @returns  {firebase_cache.Ref}
   */
  next(name, callback, errorCallback){
    let f = this.field(name)
    let newSource = f.source.next()
    console.log(newSource)
    this.createField(name, newSource, f.type)
    f = this.field(name)

    if(f.source && f.type == 'once' && !f.data){
      var handler = Hoek.reach(this, '_handle_on_'+eventTokens[0])
      f.source.once('data', handler, this._handle_error.bind(this), this)
    }
    else if(f.source && f.type == 'data' && !f.data){
      console.log('f.source.data')
      //f.source.data(this._handle_on_data.bind(this), this._handle_error.bind(this))
      this._connectDataHandler('data', f)
    }
    else if(f.source && f.type == 'val' && !f.data){
      setTimeout(()=>{
        this._handle_on_data({
          ref: f.source,
          type: 'cache'
        })
      })
    }
  }

  setFieldMode(nameMode, mode){
    if(!mode && nameMode){
      //Set all fields[].type to nameMode
    }
    else{
      //Set field fields[nameMode].type to mode
    }
  }

  setParams(values){
    this.params = values
    for(let name in this.templates){
      this.updateTemplate(name)
    }
  }

  setParam(name, value){
    this.param[name] = value
    for(let name in this.templates){
      this.updateTemplate(name)
    }
  }
}

module.exports = Model
