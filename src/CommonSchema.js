const Joi = require('joi')

exports.QueryObjSchema = Joi.object().keys({
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
  endAt: Joi.alternatives().try(
    Joi.string(),
    Joi.object().keys({
      value: Joi.string(),
      key: Joi.string()
    })
  ),
  equalTo: Joi.string()
}).nand('limitToFirst', 'limitToLast')


exports.QueryObjTemplateSchema = Joi.object().keys({
  orderBy: Joi.string(),
  limitToFirst: Joi.string(),   //String here to allow param substitution
  limitToLast: Joi.string(),    //String here to allow param substitution
  startAt: Joi.alternatives().try(
    Joi.string(),
    Joi.object().keys({
      value: Joi.string(),
      key: Joi.string()
    })
  ),
  endAt: Joi.alternatives().try(
    Joi.string(),
    Joi.object().keys({
      value: Joi.string(),
      key: Joi.string()
    })
  ),
  equalTo: Joi.string()
}).nand('limitToFirst', 'limitToLast')
