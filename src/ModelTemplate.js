'use strict'

const Joi=require('joi')
const Hoek=require('hoek')

const CommonSchema = require('./CommonSchema')

class ModelTemplate {
  constructor(options){
    let schema = Joi.object().keys({
      mode: Joi.string().default('data'),
      schema: Joi.object(),
      template: Joi.object().keys({
        uri: Joi.string().uri({allowRelative: true}).required(),
        query: CommonSchema.QueryObjTemplateSchema.optional()
      }).required()
    })

    //Is the options object valid
    let result = Joi.validate(options, schema)
    if(result.error){ throw result.error }

    this.mode = result.value.mode
    this.schema = result.value.schema
    this.template = result.value.template
  }

  applyParams(params){
    var newUri = this.template.uri
    var newQuery = Hoek.clone(this.template.query)

    function objApply(obj, param){
      let newObj = Hoek.clone(obj)
      for(let key in newObj){
        let value = newObj[key]

        if(typeof value == 'string'){
          newObj[key] = value.replace(param.key, param.value)
        }
        else if(typeof value == 'object'){
          newObj[key] = objApply(value, param)
        }
      }

      return newObj
    }

    for(let key in params){
      let value = params[key]
      newUri = newUri.replace(key, value)
      if(this.template.query){
        objApply(newQuery, {key: key, value: value})
      }
    }

    return {
      uri: newUri,
      query: newQuery
    }
  }


}

 module.exports = ModelTemplate
