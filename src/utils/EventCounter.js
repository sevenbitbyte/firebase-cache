const Joi = require('joi')

class EventCounter {
  constructor(options){
    let schema = Joi.object().keys({
      rate: Joi.boolean().optional().default(false)
    })

    let result = Joi.validate(options, schema)
    if(result.err){ throw result.err }
    this.options = result.value

    this.counters = {}
    this.timestamp = (!this.options.rate) ? undefined : {}
    this.rateMs = (!this.options.rate) ? undefined : {}
    this.avgRateMs = (!this.options.rate) ? undefined : {}
  }

  countEvent(name){
    if(!this.counters[name]){
      this.counters[name]=1

      if(this.options.rate){
        this.timestamp[name] = (new Date()).getTime()
        this.rateMs[name] = 0
        this.avgRateMs[name] = 0
      }
    }else{
      this.counters[name]++

      if(this.options.rate){
        let now = (new Date()).getTime()
        let oldRate = this.rateMs[name]
        this.rateMs[name] = now - this.timestamp[name]
        this.avgRateMs[name] = (oldRate + this.rateMs) / 2.0
      }
    }
  }
}

module.exports = EventCounter
