import TokenType from '../../util/token_type.js';
import SelectorTokenize from './selector_tokenize.js';

import {
  makePredicate, 
  hasSpaceBetweenTokens
} from '../../util/util.js';

import {createToken} from '../../util/util_ext.js';

import {
  propertyHackPrefix, 
  selectorCharUntil, 
  pseudosElements21,
  shortColor,
  shortFontWeight,
  multiSameProperty,
  atTypes,
  unMergeProperties,
  unSortProperties,
  propertyChildren
} from './config.js';

/**
 * is attribute char
 * @return {Boolean} [description]
 */
export function isAttrChar(code) {
  // >= a && <= z or - 
  return code >= 0x61 && code <= 0x7a || code === 0x2d;
}

/**
 * Calculating a selector's specificity
 * @param  {Array} tokens [selector tokens]
 * @return {Number}        []
 */
export function calculateSelectorSpecificity(tokens){
  let i = 0, length = tokens.length, token, specificity = 0, instance;
  for(; i < length; i++){
    token = tokens[i];
    switch(token.type){
      case TokenType.CSS_SELECTOR_ID:
        specificity += 100;
        break;
      case TokenType.CSS_SELECTOR_TYPE:
      case TokenType.CSS_SELECTOR_PSEUDO_ELEMENT:
        specificity += 1;
        break;
      case TokenType.CSS_SELECTOR_CLASS:
      case TokenType.CSS_SELECTOR_ATTRIBUTE:
        specificity += 10;
        break;
      case TokenType.CSS_SELECTOR_PSEUDO_CLASS:
        if (/^:not\(/i.test(token.value)) {
          instance = new SelectorTokenize(token.value.slice(5, -1));
          specificity += instance.run().group[0].specificity;
        }else{
          specificity += 10;
        }
        break;
    }
  }
  return specificity;
}
/**
 * is hack char
 */
export const isHackChar = makePredicate(propertyHackPrefix);
/**
 * selector char util
 */
export const selectorBreakChar = makePredicate(selectorCharUntil);
/**
 * is pseudo elements
 */
export function isPseudoElement(el){
  return pseudosElements21.indexOf(el) > -1;
}
/**
 * selector group token to text
 */
export function selectorGroupToken2Text(selectorGroupToken){
  return selectorGroupToken.tokens.map((token, index) => {
    let hasSpace = false;
    if(index > 0){
      hasSpace = hasSpaceBetweenTokens(selectorGroupToken.tokens[index - 1], token);
    }
    return (hasSpace ? ' ' : '') + token.value;
  }).join('');
}
/**
 * selector token to text
 */
export function selectorToken2Text(token){
  return token.ext.group.map(item => {
    return selectorGroupToken2Text(item);
  }).join(',');
}
/**
 * tokens to text
 */
export function token2Text(tokens) {
  return tokens.map((token, index) => {
    let prefix = token.commentBefore.map(item => item.value).join('');
    switch(token.type){
      case TokenType.CSS_SELECTOR:
        return prefix + selectorToken2Text(token);
      case TokenType.CSS_PROPERTY:
        return prefix + token.value;
      case TokenType.CSS_VALUE:
        let value = token.ext.prefix + token.ext.value + token.ext.suffix;
        if(token.ext.important){
          value += '!important';
        }
        return prefix + value;
      case TokenType.CSS_RIGHT_BRACE:
        if(index > 0){
          let prev = tokens[index - 1];
          // template syntax right delemiter maybe %}
          if(prev.type === TokenType.CSS_VALUE && 
            !token.ext.prefix && 
            !token.ext.important &&
            prev.ext.value.slice(-1) === '%'){
            return prefix + ';' + token.value;
          }
        }
        return prefix + token.value;
      default:
        return prefix + token.value;
    }
  }).join('');
}

/**
 * short for num value
 * margin: 10px 20px 10px 20px;
 */
export function short4NumValue(value, append = {}, returnArray = false){
  if(!Array.isArray(value)){
    value = value.split(/ +/);
  }
  let length = value.length;
  let v = [
    [], 
    [0, 0, 0, 0],
    [0, 1, 0, 1],
    [0, 1, 2, 1],
    [0, 1, 2, 3]
  ];
  let sv = v[length];
  value = [
    value[sv[0]], 
    value[sv[1]], 
    value[sv[2]], 
    value[sv[3]]
  ];
  for(let index in append){
    value[index | 0] = append[index];
  }
  if(value[1] === value[3]){
    value.splice(3, 1);
  }
  if(value.length === 3 && value[0] === value[2]){
    value.splice(2, 1);
  }
  if(value.length === 2 && value[0] === value[1]){
    value.splice(1, 1);
  }
  if(returnArray){
    return value;
  }
  return value.join(' ').trim();
}
/**
 * rgb to hex
 */
export function rgb2Hex(value, r, g, b){
  if(value === true){
    let v = [r | 0, g | 0, b | 0];
    let result = '#';
    v.forEach(item => {
      result += (item < 16 ? '0' : '') + item.toString(16);
    });
    return result;
  }
  if(value.indexOf('rgb') === -1){
    return value;
  }
  let rgbRex = /rgb\s*\(\s*(\d+)\s*\,\s*(\d+)\s*\,\s*(\d+)\s*\)/g;
  value = value.replace(rgbRex, (a, r, g, b) => {
    return rgb2Hex(true, r, g, b);
  });
  return value;
}
/**
 * get short value
 */
export function getShortValue(value, property){
  // http://www.w3schools.com/cssref/pr_border-width.asp
  property = property.toLowerCase();
  if(property === 'border-color' || property === 'border-style' || property === 'border-width'){
    return short4NumValue(value);
  }
  let list = {
    color: shortColor,
    'border-top-color': shortColor,
    'border-left-color': shortColor,
    'border-right-color': shortColor,
    'border-bottom-color': shortColor,
    'background-color': shortColor,
    'font-weight': shortFontWeight
  };
  // rgb(0,0,0) -> #000000 (or #000 in this case later)
  value = rgb2Hex(value);
  if(property in list){
    return list[property][value] || value;
  }
  return value;
}

/**
 * is multi same property
 */
export function isMultiSameProperty(property, value){
  if(value.indexOf('calc') > -1){
    return true;
  }
  return !!multiSameProperty[property];
}
/**
 * merge properties
 */
export function mergeProperties(attrs1, attrs2){
  for(let key in attrs2){
    if(attrs1[key]){
      if(!attrs1[key].value.ext.important || attrs2[key].value.ext.important){
        delete attrs1[key];
        attrs1[key] = attrs2[key];
      }
    }else{
      attrs1[key] = attrs2[key];
    }
  }
  return attrs1;
}
/**
 * is @ type
 */
export function isAtType(type){
  return !!atTypes[type];
}
/**
 * can not merged property
 */
export function isUnMergeProperty(property, value){
  let v = unMergeProperties[property.toLowerCase()];
  if(!v){
    return false;
  }
  if(typeof v === 'boolean'){
    return v;
  }
  return v.test(value);
}
/**
 * is unsort property
 */
export function isUnSortProperty(property){
  return unSortProperties.some(item => {
    return item === property || property.indexOf(item + '-') > -1;
  });
}

/**
 * combine property
 * 
 *  a{padding: 10px; padding-left: 20px;} => a{padding: 20px 10px 10px 10px}
 */
export function mergePropertyChildren(attrs, type = 'padding'){
  let list = propertyChildren[type];
  let properties = {[type]: 0};
  list.forEach(item => properties[item] = 0);
  
  for(let key in attrs){
    let {property, value} = attrs[key];
    // if has tpl or hack in attrs, can not combine it
    if(!property || 
        property.type === TokenType.TPL ||
        value.type === TokenType.TPL || 
        value.type === TokenType.CSS_BRACK_HACK){
      return attrs;
    }
    let propertyValue = property.value.toLowerCase();
    if(propertyValue in properties){
      if(property.ext.prefix || 
         value.ext.suffix || 
         value.ext.important || 
         value.ext.prefix){
        return attrs;
      }else{
        properties[propertyValue] = 1;
      }
    }
  }
  if(properties[type]){
    /**
     * 避免出现这种情况
     * 
    .manage-content {
        padding-top: 20px;
        background: #fff;
        padding: 0 26px 20px;
    }
    */
    let attrsKeys = Object.keys(attrs);
    let mainIndex = attrsKeys.indexOf(type);
    let append = {};
    let value = attrs[type].value.ext.value;
    list.forEach((item, index) => {
      if(properties[item]){
        let idx = attrsKeys.indexOf(item);
        if(idx > mainIndex){
          append[index] = attrs[item].value.value;
        }
        delete attrs[item];
      }
    });
    attrs[type].value.ext.value = short4NumValue(value, append);
    attrs[type].value.value = attrs[type].value.ext.value;
  }else{
    let flag = list.every(item => {
      return properties[item];
    });
    if(!flag){
      return attrs;
    }
    let value = [];
    list.forEach((item, index) => {
      value[index] = attrs[item].value.ext.value;
      delete attrs[item];
    });
    let propertyToken = createToken(TokenType.CSS_PROPERTY, type);
    propertyToken.ext = {
      prefix: '',
      value: type,
      suffix: ''
    };
    let shortValue = short4NumValue(value);
    let valueToken = createToken(TokenType.CSS_VALUE, shortValue);
    valueToken.ext = {
      prefix: '',
      value: shortValue,
      suffix: '',
      important: false
    };
    attrs[type] = {
      property: propertyToken,
      value: valueToken
    };
  }
  return attrs;
}