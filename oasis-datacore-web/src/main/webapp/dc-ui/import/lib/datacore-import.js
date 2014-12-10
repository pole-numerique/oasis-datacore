//var containerUrl = "http://data.oasis-eu.org/"; // rather in dcConf filled at init by /dc/playground/configuration
  
  // first four letters of model import file
  function buildModelDomainPrefix(modelFileName) {
     return modelFileName.substring(modelFileName.lastIndexOf('/') + 1, 3).toLowerCase();
  }
  
  function trimIfAnyElseNull(value) {
     if (typeof value === 'string') {
        value = value.trim();
        if (value.length == 0) {
           return null;
        }
        return value;
     }
     return null;
  }
   // on csv value only
   function setTrimIfAny(fields, fieldName, value) {
      if (typeof value !== 'undefined') {
         //if (value.length != 0) {
         value = value.trim();
         var existingValue = fields[fieldName];
         if (value.length != 0 && (typeof existingValue === 'undefined' || existingValue == null)) {
            fields[fieldName] = value;
         }
      }
   }
  
   function identity(s) {
      return s;
   }
   var defaultCsvDateFormat = "YYYYMMDD" + "Z"; // TODO in model csv ?!
   var defaultTimezone = "+01:00"; // fr summer timezone ; TODO winter hour !!
   var convertMap = {
      "date" : function(stringValue) { return moment(stringValue + defaultTimezone,
          defaultCsvDateFormat).format("YYYY-MM-DDTHH:mm:ssZ"); }, // rather than .toISOString()
          // which converts dates to GMT and don't preserve timezone, see http://momentjs.com/docs/
      "resource" : identity, // NOT subresource
      "map" : identity,
      "i18n" : identity, // list of map
      // numbers : see http://stackoverflow.com/questions/5450012/how-to-convert-a-string-to-long-in-javascript
      "boolean" : function(stringValue) {
         return typeof stringValue === 'string' && "true" === stringValue.trim().toLowerCase();
      },
      "int" : function(stringValue) { return parseInt(stringValue, 10); },
      "float" : parseFloat,
      "long" : identity, // javascript has no long, though int ones could be parsed
      "double" : identity, // idem
      "list" : function(stringValue, mixinField) {
         var values = [];
         var stringValues = stringValue.split(",");
         var listElementField = mixinField["dcmf:listElementField"];
         for (var svInd in stringValues) {
            values.push(convertValue(stringValues[svInd], listElementField));
         }
         return values;
      }
      // TODO i18n (list of maps) (not here : map, subresource)
   }
   function convertValue(stringValue, mixinField) {
      if (typeof stringValue === 'undefined' || stringValue == null) {
         return null; // TODO raise error, shouldn't happen in CSV !(?)
      }
      stringValue += ''; // convert to string if ex. number
      var fieldType = mixinField["dcmf:type"];
      if ("string" === fieldType || "i18n" === fieldType) {
         if (stringValue.length === 0) { // but don't trim
            return null; // empty is none
         }
         if (mixinField["importconf:evalAsJs"]) {
            return eval(stringValue);
         }
         return stringValue;
      }
      // else trim before parsing :
      stringValue = stringValue.trim();
      if (stringValue.length == 0) {
         return null;
      }
      var convertFunction = convertMap[fieldType];
      if (convertFunction === 'undefined') { // TODO error
         return "ERROR unknown type " + fieldType + " for value " + stringValue;
      }
      return convertFunction(stringValue, mixinField);
   }
   
   function getDefaultValueIfAny(mixinField, importState,
         defaultStringValue) { // optional
      if (typeof defaultStringValue === 'undefined') {
         defaultStringValue = mixinField["dcmf:defaultStringValue"];
      }
      if (typeof defaultStringValue === 'undefined') {
         var genericDefaultValue = convertImportConfValue(importState.model.defaultRow["defaultValue"], 'string');
         if (typeof genericDefaultValue !== 'undefined' && genericDefaultValue !== null) {
            defaultStringValue = genericDefaultValue;
         }
      }
      if (typeof defaultStringValue !== 'undefined') {
         // set default value when not among imported fields (no internalName) :
         if (defaultStringValue.charAt(0) == "\"" && defaultStringValue.charAt(defaultStringValue.length - 1) == "\"") {
            // handling Datacore server-serialized stringValue :
            defaultStringValue = defaultStringValue.substring(1, defaultStringValue.length - 1);
         }
         return convertValue(defaultStringValue, mixinField);
      }
      return null;
   }
   
   /*function setValueOrDefaultIfAny(resource, mixinField, stringValue) {
      var value = convertValue(stringValue, mixinField);
      if (value != null) {
         resource[mixinField["dcmf:name"]] = value;
         return value;
      }
      var defaultStringValue = mixinField["dcmf:defaultStringValue"];
      if (typeof defaultStringValue !== 'undefined') {
         // set default value when not among imported fields (no internalName) :
         resource[mixinField["dcmf:name"]] = convertValue(defaultStringValue, mixinField);
         return true;
      }
      return false;
   }*/
   
   var globalDefaultLanguage = 'en';
   
   function getDefaultLanguage(i18nField, importState,
         mixin) { // for log purpose
      var defaultLanguage = i18nField['dcmf:defaultLanguage'];
      if (typeof defaultLanguage === 'undefined') {
         var genericDefaultLanguage = convertImportConfValue(importState.model.defaultRow["defaultLanguage"], 'string');
         if (typeof genericDefaultLanguage !== 'undefined' && genericDefaultLanguage !== null) {
            defaultLanguage = genericDefaultLanguage;
         }
      }
      if (typeof defaultLanguage === 'undefined') {
         defaultLanguage = globalDefaultLanguage;
         importState.data.warnings.push({ code : "i18nHasNoDefaultLanguage",
               mixin : mixin['dcmo:name'], fieldName : i18nField['dcmf:name'],
               message : "ERROR i18nHasNoDefaultLanguage" });
      }
      return defaultLanguage;
   }
   
   // on primitive values only
   function contains(list, obj) {
      var i = list.length;
      while (i--) {
         var item = list[i];
         if (item === obj) {
            return true;
         }
      }
      return false;
   }
   
   function containsDeepEquals(list, obj) {
      var i = list.length;
      while (i--) {
         var item = list[i];
         if (deepEquals(item, obj)) {
            return true;
         }
      }
      return false;
   }

   // at least a must not be undefined
   function deepEquals(a, b) {
      if (a === b) {
         return true;
      }
      if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
         return false;
      }
      if (Object.keys(a).length !== Object.keys(b).length) {
         return false; // shortcut
      }
      for (var i in a) {
         if (!deepEquals(a[i], b[i])) {
            return false;
         }
      }
      for (var i in b) {
         if (typeof b[i] === undefined) {
            return false;
         }
      }
      return true;
   }
   
   // at least a must not be undefined
   /*function merge(a, b) {
      if (a === b) {
         return a;
      }
      if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
         return null;
      }
      for (var i in a) {
         var aVal = a[i];
         var bVal = b[i];
      }
      for (var i in b) {
         if (!equals(a[i], b[i])) {
            return false;
         }
      }
      return true;
   }*/
   
   function findField(fieldName, mixinFields) {
      for (var fInd in mixinFields) {
         var field = mixinFields[fInd];
         if (field["dcmf:name"] === fieldName) {
              return field;
         }
      }
      return null;
   }
   
   function findMixin(mixinName, mixins) {
      for (var mInd in mixins) {
         var mixin = mixins[mInd];
         if (mixin["dcmo:name"] === mixinName) {
            return mixin;
         }
      }
      return null;
   }
   
   function hasMixin(modelOrMixinResourceOrName, mixinName, importState) {
      var modelOrMixinResource = (typeof modelOrMixinResourceOrName === 'string') ?
            findMixin(modelOrMixinResourceOrName, importState.data.involvedMixins) : modelOrMixinResourceOrName;
      return contains(modelOrMixinResource["dcmo:globalMixins"], mixinName);
   }

   // returns first found but adds error if several
   // WARNING may still be wrong if only one, if not yet parsed the right one in the row
   function findBestMatchingRowResourceForType(resourceType, modelTypeToRowResources, importState) {
      if (importState.data.row.loopIndex === 0) {
         importState.data.errors.push({ code : "shouldNotCallInFirstLoopFindBestMatchingRowResourceForType",
               message : "ERROR shouldNotCallInFirstLoopFindBestMatchingRowResourceForType" });
         return null;
      }
      if (modelTypeToRowResources === null) {
         return null;
      }
      var bestRowResource = modelTypeToRowResources[resourceType];
      if (typeof bestRowResource !== 'undefined') {
         return bestRowResource; // exact match
      }
      var foundRowModelOrMixinName = null;
      for (var rowModelOrMixinName in modelTypeToRowResources) {
         var rowModelOrMixin = importState.model.modelOrMixins[rowModelOrMixinName];
         if (typeof rowModelOrMixin === 'undefined') {
            importState.data.errors.push({ code : "rowModelOrMixinNameNotAmongInvolvedMixins",
                  rowModelOrMixinName : rowModelOrMixinName,
                  message : "ERROR rowModelOrMixinNameNotAmongInvolvedMixins" });
            return null;
         }
         
         // NB. can't be an exact match (has been tested above), so look among mixins :
         var globalMixins = rowModelOrMixin['dcmo:globalMixins'];
         for (var tInd in globalMixins) { // iterating in the order of inheritance
            var mixinName = globalMixins[tInd];
            if (mixinName === resourceType) {
               if (foundRowModelOrMixinName === null) {
                  foundRowModelOrMixinName = rowModelOrMixinName;
               } else {
                  importState.data.errors.push({ code : "moreThanOneCompatibleRowResourceForType",
                     resourceType : resourceType, rowResources :
                     { foundRowModelOrMixinName : modelTypeToRowResources[foundRowModelOrMixinName],
                          rowModelOrMixinName : modelTypeToRowResources[rowModelOrMixinName] },
                     message : "ERROR moreThanOneCompatibleRowResourceForType" });
                  return null; // else autolinking might get wrong !!
               }
            }
         }
      }
      
      if (foundRowModelOrMixinName !== null) {
         return modelTypeToRowResources[foundRowModelOrMixinName];
      } // TODO PERF
      return null;
   }
   
   // TODO LATER handle different id creation policy in subtypes
   function findResourceByUriId(subresource, mixin, importState) {
      var resourceType = mixin['dcmo:name'];
      var subResourceUri = subresource["@id"];
      var subResourceId = getIdFromUri(subResourceUri);
      for (var modelOrMixinName in importState.model.modelOrMixins) {
         var modelOrMixin = importState.model.modelOrMixins[modelOrMixinName];
         if (modelOrMixin['dcmo:isInstanciable']) {
            // NB. can't be exact match, has been tested above not to be instanciable
            var globalMixins = modelOrMixin['dcmo:globalMixins'];
            for (var tInd in globalMixins) { // ((iterating in the order of inheritance))
               var mixinName = globalMixins[tInd];
               if (mixinName === resourceType) { // this modelOrMixin is an instance of resourceType
                  var candidateUri = buildUri(modelOrMixinName, subResourceId);
                  var candidateResource = importState.data.resources[candidateUri];
                  if (typeof candidateResource !== 'undefined') {
                     // merge over existing resource (without overriding especially uri) :
                     // NB. works for fields but also native fields ex. modified...
                     mergeValues(candidateResource, subresource, resourceType, importState);
                     return candidateResource;
                  }
               }
            }
         }
      } // TODO PERF
      return null;
   }
   
   // TODO LATER
   function findResourceOrMapByKeyFieldsInList(newResourceOrMap, existingList, fields, importState) {
      importState.data.errors.push({ code : "findResourceOrMapByKeyFieldsInListNotYetImplemented", message : "" });
      return null;
   }
   // at least existingItem must not be undefined
   function isCompatibleWith(newItem, existingItem, allFields, importState) {
      if (newItem === existingItem) {
         return true;
      }
      if (newItem === null) {
         return true;
      }
      var typeOfNewItem = typeof newItem;
      if (typeOfNewItem === 'undefined') {
         return true;
      }
      if (typeOfNewItem !== 'object' || typeof existingItem !== 'object') {
         return false;
      }
      if (newItem instanceof Array) {
         if (!(existingItem instanceof Array)) {
            return false; // TODO handle it elsewhere
         }
         return true; // either there is a compatible value in the existing list, or a new one can merely be added
      }
      for (var i in existingItem) {
         if (typeof allFields[i] === 'undefined') {
            continue; // native field ex. @type
         }
         if (!isCompatibleWith(existingItem[i], newItem[i])) {
            return false;
         }
      }
      // newItem may have additional key values
      return true;
      //return false; // TODO PERF !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! OK !!!
   }
   // returns first found but adds error if several
   function findResourceOrMapByAllFieldsInList(newResourceOrMap, existingList, allFields, importState) {
      var found = null;
      for (var elInd in existingList) {
         var existingResourceOrMap = existingList[elInd];
         if (isCompatibleWith(newResourceOrMap, existingResourceOrMap, allFields, importState)) {
            if (found === null) {
               found = existingResourceOrMap;
            } else {
               importState.data.errors.push({ code : "severalResourceOrMapFoundByAllFields",
                     found : [ found, existingResourceOrMap ], fields : allFields,
                     message : "ERROR severalResourceOrMapFoundByAllFields" });
               break;
            }
         }
      } // TODO PERF
      return found;
   }

   function mergeValues(existingResourceOrMap, newResourceOrMap, allFields, importState) {
      for (var key in newResourceOrMap) {
         // NB. works for fields but also native fields ex. modified...
         mergeValue(existingResourceOrMap, key, newResourceOrMap[key], allFields[key], importState);
      }
   }
   function mergeListValue(existingList, newValueElt, nvInd, listElementField, importState) {
      //if (true) return; ///////////////////// TODO PERF ! OK !!!
      var fieldType = listElementField["dcmf:type"];
      if (fieldType === 'list' || fieldType === 'i18n') {
         // list of list or of i18n, TODO LATER
         importState.data.errors.push({ code : "listWithinListNotYetImplemented",
               listOfList : existingList, value : newValueElt, listElementField : listElementField,
               message : "ERROR listWithinListNotYetImplemented" });
         return;
         // for each new list value, try to find in ONE of the existing sublists :
         /*if (!(newValueElt instanceof Array)) {
            importState.data.errors.push({ code : "listWithinListNotArray",
                  listOfList : existingList, value : newValueElt, listElementField : listElementField,
                  message : "ERROR listWithinListNotArray" });
         }
         var listWithinListElementField = fieldType['dcmf:listElementField'];
         for (var nlwlvInd in newValueElt) {
            var newListWithinListValue = newValueElt[nlwlvInd];
            var foundExistingListWithinListValue = null;
            for (var elwlInd in existingList) {
               var existingListWithinList = existingList[elwlInd];
               // TODO or key subfield specified on list field ???
               var existingListWithinListValue = findResourceOrMapByKeyFieldsInList(newListWithinListValue,
                     existingListWithinList, listWithinListElementField, importState);
               if (existingListWithinListValue !== null) {
                  if (foundExistingListWithinListValue !== null) {
                     // unable to decide
                     importState.data.errors.push({ code : "listWithinListHasTooManyCandidates",
                           message : "ERROR listWithinListHasTooManyCandidates" });
                  }
                  foundExistingListWithinListValue = existingListWithinListValue;
               }
            }
            if (foundExistingListWithinListValue !== null) {
               mergeValue(foundExistingListWithinListValue, key, newValue, fields, importState);
               mergeValues(foundExistingListWithinListValue, newResourceOrMap, fields, importState);
            } else {
               
            }
         }*/
      
      } else if (fieldType === 'resource' && typeof newValue === 'object') { // embedded resource TODO LATER better test on getStorage() = concrete resource model & storagePath
         var modelOrMixin = importState.model.modelOrMixins[existingValue['@type'][0]];
         // NB. using "most concrete" existingValue fields as guide
         var subresourceFields = modelOrMixin['dcmo:globalFields'];
         // TODO or key subfield specified on list field ???
         /* NOO for now mere merge
         // TODO or key subfield specified on list field ???
         var existingSubresourceFound = findResourceOrMapByKeyFieldsInList(newValueElt, existingList, subresourceFields, importState);
         */
         var existingSubresourceFound = findResourceOrMapByAllFieldsInList(newValueElt, existingList, subresourceFields, importState);
         if (existingMapFound === null) {
            existingList.push(newValueElt);
         } else {
            mergeValue(existingSubresourceFound, null, newValueElt, subresourceFields, importState);
         }
         
      } else if (fieldType === 'map') {
         /* NOO for now mere merge
         // TODO or key subfield specified on list field ???
         var existingMapFound = findResourceOrMapByKeyFieldsInList(newValueElt, existingList, listElementField, importState);
         */
         var listMapFields = listElementField['dcmf:mapFields'];
         // NB. using "most concrete" existingValue fields as guide
         var existingMapFound = findResourceOrMapByAllFieldsInList(newValueElt, existingList, listMapFields, importState);
         if (existingMapFound === null) {
            existingList.push(newValueElt);
         } else {
            mergeValue(existingMapFound, null, newValueElt, listMapFields, importState);
         }
         
      } else if (!contains(existingList, newValueElt)) { // primitive value not yet in list
         existingList.push(newValueElt);
      } // else primitive value already in list
   }
   // merge new value over existing resource :
   // also list (primitives as sets, LATER beyond id / key subfields should be used), i18n, map & embedded subresource
   // NB. key param is required only if no or default existing value
   function mergeValue(existingResource, key, newValue, allFields, importState) {
      if (typeof newValue === 'undefined' || newValue == null
            || typeof newValue === 'string' && newValue.length == 0) {
         return; // no new value to merge
      }
      var existingValue = existingResource[key];
      if (typeof existingValue === 'undefined' || existingValue == null
            || typeof newValue === 'string' && existingValue.length == 0 // empty string
            || typeof newValue instanceof Array && existingValue.length === 0) { // empty list
         existingResource[key] = newValue; // TODO more empty, conflicts
         return;
      }
      if (typeof existingValue instanceof Array) {
         // string as single value list but should not happen
         existingValue.push(newValue);
         return;
      }
      var field = findField(key, allFields);
      if (field === null) {
         return; // native fields ex. @id
      }
      var fieldType = field["dcmf:type"];
      if (fieldType === 'list' || fieldType === 'i18n') {
         // NB. existingValue has at least one value, because tested above
         if (newValue instanceof Array) {
            for (var nvInd in newValue) {
               mergeListValue(existingValue, newValue[nvInd], nvInd, field["dcmf:listElementField"], importState); // TODO or key subfield specified on list field ???
            }
         } else { // TODO better for non primitive values...
            mergeListValue(existingValue, newValue, 0, field["dcmf:listElementField"], importState);
         }
         
      } else if (fieldType === 'map') {
         mergeValues(existingValue, newValue, field['dcmf:mapFields'], importState);
         
      } else if (fieldType === 'resource' && typeof newValue === 'object') { // embedded resource TODO LATER better test on getStorage() = concrete resource model & storagePath
         var modelOrMixin = importState.model.modelOrMixins[existingValue['@type'][0]];
         // NB. iterating over newValue values, but using "most concrete" existingValue fields as guide
         mergeValues(existingValue, newValue, modelOrMixin['dcmo:globalFields'], importState);
         
      } else if (existingValue === newValue) {
         // nothing to do
      } else if (existingValue === convertValue(field['dcmf:defaultStringValue'], field)) {
         // (including external resource case)
         existingResource[key] = newValue; // allow to override default value
      } else {
         importState.data.errors.push({ code : "incompatiblePrimitiveValueMerge",
               resource : existingResource, key : key, newValue : newValue,
               message : "ERROR incompatiblePrimitiveValueMerge" });
      }
   }

   function convertImportConfValue(stringValue, valueType) {
      if (typeof stringValue === 'undefined' || stringValue == null) {
         return null; // TODO raise error, shouldn't happen in CSV !(?)
      }
      if ("string" === valueType || 'i18n' === valueType) {
         if (stringValue.length === 0) { // but don't trim
            return null; // empty is none
         }
         return stringValue;
      }
      // else trim before parsing :
      stringValue = stringValue.trim();
      if (stringValue.length == 0) {
         return null;
      }
      var convertFunction = convertMap[valueType];
      if (convertFunction === 'undefined') { // TODO error
         return "ERROR unknown type " + valueType + " for value " + stringValue;
      }
      return convertFunction(stringValue);
   }
   function mergeImportConfStringValue(existingResource, key, newStringValue, valueType) {
      var newValue = convertImportConfValue(newStringValue, valueType);
      if (typeof newValue === 'undefined' || newValue == null
            || typeof newValue === 'string' && newValue.length == 0) {
         return; // no new value to merge
      }
      var existingValue = existingResource[key];
      if (typeof existingValue === 'undefined' || existingValue == null
            || typeof newValue === 'string' && existingValue.length == 0) {
         existingResource[key] = newValue; // TODO more empty, conflicts
      }
      // else don't override
   }
   
   function mergeStringValueOrDefaultIfAny(existingResource, key, newStringValue, mixin, importState,
         defaultStringValue) { // optional
      var mergeField = findField(key, mixin["dcmo:globalFields"]);
      var newValue = convertValue(newStringValue, mergeField);
      if (newValue === null) {
         var existingValue = existingResource[key];
         if (typeof existingValue === 'undefined' || existingValue === null) {
            // no value yet
            if (typeof defaultStringValue !== 'undefined') {
               newValue = convertValue(defaultStringValue, mergeField);
            }
            if (newValue === null) {
               var defaultStringValue = mergeField["dcmf:defaultStringValue"];
               if (typeof defaultStringValue !== 'undefined') {
                  newValue = convertValue(defaultStringValue, mergeField);
               }
            }
         } // else no need to compute default value, there is already one
      }
      mergeValue(existingResource, key, newValue, mixin["dcmo:globalFields"], importState);
   }
   

   function decodeIdSaveIfNot(idValue, idField) {
      if (typeof idField !== 'undefined' && idField !== null) {
         var dontDecode = idField["importconf:dontEncodeIdInUri"];
         if (dontDecode) {
            return idValue;
         }
      }
      var slashSplitId = idValue.split('/');
      for (var idCptInd in slashSplitId) {
         slashSplitId[idCptInd] = decodeURIComponent(slashSplitId[idCptInd]); // decoding !
      }
      return slashSplitId.join('/');
      //return decodeURI(idValue); // decoding !
      // (rather than decodeURIComponent which would not accept unencoded slashes)
   }
   function encodeIdSaveIfNot(idValue, idField) {
      if (typeof idField !== 'undefined' && idField !== null) {
         var dontEncode = idField["importconf:dontEncodeIdInUri"];
         if (dontEncode) {
            return idValue;
         }
      }
      return encodeUriPath(idValue);
   }
   
   

   function importedResourcePosted(resourcesOrErrorData, importStateRes, importState, kind, counter, origResources,
         success, error) { // optional
      importStateRes.postedNb++;
      
      if (typeof resourcesOrErrorData === 'object' && typeof resourcesOrErrorData["_headers"] === 'object') {
         // error response
         importStateRes.errors.push([ resourcesOrErrorData._body._body, resourcesOrErrorData.request._body ]);
         var requestBodyHtml = toolifyDcListOrResource(origResources);
         // NB. no need of wrapping by [...] and taking [0] because always there
         importStateRes.errorHtml += "<p>-&nbsp;" + resourcesOrErrorData._body._body
               + " :<br/>" + requestBodyHtml + "<p/>";
         for (var rInd in origResources) {
            var origResource = origResources[rInd];
            importStateRes.postedResources[origResource['@id']] = null; // set
         }
         
      } else {
         for (var rInd in resourcesOrErrorData) {
            var postedResource = resourcesOrErrorData[rInd];
            importStateRes.postedResources[postedResource['@id']] = postedResource; // set
         }
         /*if (typeof resourcesOrData['@id'] !== 'undefined') {
            importStateRes.postedResources[resourcesOrData['@id']] = null; // set
         } else { // usual case : single value list
            for (var rInd in resourcesOrData) {
               importStateRes.postedResources[resourcesOrData[rInd]['@id']] = null; // set
            }
         }*/
      }
      
      if (true/*importStateRes.postedNb % 1000 == 0 || importStateRes.postedNb > importStateRes.toBePostedNb - 10*/) {
         var msg = "Posted <a href=\"#importedResourcesFromCsv\">" + importStateRes.postedNb
               + " " + kind + "s</a> (";
         if (importStateRes.errors.length === 0) {
            msg += "no error";
            msg += "), <a href=\"#datacoreResources\">browse them</a>";
         } else {
            msg += "<a href=\"#datacoreResources\">" + importStateRes.errors.length + " error"
            if (importStateRes.errors.length !== 1) {
               msg += "s";
            }
            msg += "</a>";
            msg += ")";
         }
         counter.html(msg);
         if (importStateRes.errors.length != 0) {
            $('.mydata').html(importStateRes.errorHtml);
         }
      }
      
      if (Object.keys(importStateRes.postedResources).length === importStateRes.toBePostedNb) {
         displayImportedResourcesPosted(importStateRes);
         
         if (importStateRes.errors.length == 0) {
            console.log("INFO Successfully posted " + importStateRes.postedNb + " " + kind + "s.");
            if (typeof success !== 'undefined') {
               success(importState);
            }
         } else {
            console.log("WARNING Posted " + importStateRes.postedNb + " "+ kind
                  + "s with " + importStateRes.errors.length + " errors.");
            if (typeof error !== 'undefined') {
               error(importState);
            }
         }
         return true;
      }
      return false;
   }
   function displayImportedResourcesPosted(importStateRes) {
      setUrl('/dc');
      $('.mydata').html(toolifyDcResource(importStateRes.postedResources, 0)); // , null, getModelTypeFromUri(data.request.path)
   }
   
   
   function importMapOrResourceValue(fieldOrListField, resourceRow, subFieldNameTree,
         mixin, fieldName, subPathInFieldNameTree, importState) { // log purpose only
      var value = null;
      var fieldOrListFieldType = fieldOrListField["dcmf:type"];
      var resourceType = fieldOrListField["dcmf:resourceType"];
      var resourceMixinOrFields;
      if (fieldOrListFieldType === 'resource') {
         // resource tree : looking for value in an (indirectly) referenced resource
         resourceMixinOrFields = findMixin(resourceType, importState.data["involvedMixins"]);
         if (typeof resourceMixinOrFields === 'undefined') {
            importState.data.errors.push({ code : "unknownReferencedMixin",
                  path : subPathInFieldNameTree.join('.'), referencedMixin : resourceType,
                  message : "ERROR can't find resource field referenced mixin "
                  + resourceType + " among involved mixins" });
            return null;
         }
      } else if (fieldOrListFieldType === 'map') {
         resourceMixinOrFields = fieldOrListField['dcmf:mapFields'];
      } else {
         importState.data.errors.push({ code : "badFieldTypeForImportFieldTreeNode", fieldType : fieldOrListFieldType,
               mixin : mixin['dcmo:name'], fieldName : fieldName, path : subPathInFieldNameTree.join('.'),
               message : "ERROR badFieldTypeForImportFieldTreeNode" });
         return null;
      }
      
      // (sub)resource field values might be provided, let's look for them
      var subresource = csvRowToDataResource(resourceMixinOrFields, resourceRow,
            subFieldNameTree, subPathInFieldNameTree, null, importState);
      if (importState.aborted) {
         return abortImport(); // not only with csvRowToDataResource() else the Abort message would get overwritten 
      }
      
      if (subresource === null) {
         // (may be solved in next iteration)
         importState.data.warnings.push({ code : "subresourceWithoutValue",
               mixin : mixin['dcmo:name'], fieldName : fieldName, path : subPathInFieldNameTree.join('.'),
               message : "WARNING subresourceWithoutValue" });
         
      } else if (fieldOrListFieldType === 'map') {
         value = subresource;
            
      } else if (typeof subresource["@id"] === 'undefined') {
         // (may be solved in next iteration)
         importState.data.errors.push({ code : "unableToBuildSubresourceId",
               mixin : mixin['dcmo:name'], fieldName : fieldName, path : subPathInFieldNameTree.join('.'), subresource : subresource,
               message : "ERROR unableToBuildSubresourceId" });
         
      } else if (resourceMixinOrFields['dcmo:isInstanciable']) { // resource with (probably) exact instance model type ;
         // TODO TODO better is subresource ex. storage(Path) == modelx/path ; typeof value !== 'undefined' && value != null && value.length != 0
         value = subresource["@id"]; // uri
         // adding it :
         importState.data.resources[subresource['@id']] = subresource;
         /*if (modelTypeToRowResources != null) { NOOOOOOOOOOO only if top level, for autolinking
            modelTypeToRowResources[resourceType] = subresource; // in case not yet there
         }*/
         
      } else/* if ()*/ { // resource with abstract type : don't import but look for compatible (sub)type and same id
         return findResourceByUriId(subresource, resourceMixinOrFields, importState);
         
      }/* else { // subresource ; TODO TODO better is subresource ex. storage(Path) == modelx/path ; typeof value !== 'undefined' && value != null && value.length != 0
         value = subresource;
      }*/
      return value;
   }
   
   // pathInFieldNameTree for log only ; mixin must be dcmo:isInstanciable (old "model")
   function csvRowToDataResource(mixin, resourceRow,
         fieldNameTree, pathInFieldNameTree,
         modelTypeToRowResources, importState) {
      var typeName = mixin["dcmo:name"];
      var mixinFields, enrichedModelOrMixinFieldMap;
      var topLevelResource = false;
      if (typeof typeName === 'undefined') {
         // assuming map
         typeName = 'map'; // ??
         mixinFields = mixin;
         enrichedModelOrMixinFieldMap = importState.model.modelOrMixins[pathInFieldNameTree[0]]['dcmo:fields']; // for import-specific data lookup
         for (var pInd = 1; pInd < pathInFieldNameTree.length; pInd++) {
            var enrichedSubField = enrichedModelOrMixinFieldMap[pathInFieldNameTree[pInd]];
            var enrichedSubFieldType = enrichedSubField['dcmf:type'];
            while (enrichedSubFieldType === 'list' || enrichedSubFieldType === 'i18n') {
               enrichedSubField = enrichedSubField['dcmf:listElementField'];
               enrichedSubFieldType = enrichedSubField['dcmf:type'];
            }
            enrichedModelOrMixinFieldMap = enrichedSubField['dcmf:mapFields'];
            // TODO TODO or (sub)resource !!
         }
      } else {
         if (fieldNameTree === null) {
            topLevelResource = true;
            fieldNameTree = importState.model.mixinNameToFieldNameTree[typeName];
         }
         mixinFields = mixin["dcmo:globalFields"];
         enrichedModelOrMixinFieldMap = importState.model.modelOrMixins[typeName]["dcmo:globalFields"]; // for import-specific data lookup
      }
      var resource = null;
      if (modelTypeToRowResources != null // means top level resource, parsed with actual concrete instance model type
            // else recursive import along fieldNameTree import plan
            && importState.data.row.loopIndex !== 0) { // else not all top level resources have been parsed yet so might be wrong 
         resource = findBestMatchingRowResourceForType(typeName, modelTypeToRowResources, importState);
      }
      if (resource === null) {
         resource = {};
      }
      var mixinHasValue = false;
      var mixinHasAutolinkedValue = false;
      var mixinHasDefaultValue = false;
      
      //for (var fieldName in (Object.keys(fieldNameTree).length !== 0 ?
      //      fieldNameTree : enrichedModelOrMixinFieldMap)) {
      for (var fieldName in enrichedModelOrMixinFieldMap) {
         if (importState.aborted) {
            throw "aborted";
         }
         
         var fieldOrListField = enrichedModelOrMixinFieldMap[fieldName];
         if (typeof resource[fieldName] !== 'undefined') {
            mixinHasValue = true;
            continue; // skipping, value already found in this row WARNING NOT FOR MULTIPLE LANGUAGES IN A SINGLE LINE
         }
         
         var subFieldNameTree = fieldNameTree[fieldName];
         // copy and stack up subPathInFieldNameTree : TODO LATER push on & pop from stack
         var subPathInFieldNameTree = [];
         var enrichedModelOrMixinField = enrichedModelOrMixinFieldMap[fieldName]; // allows lookup of import-only conf
         for (var pInd in pathInFieldNameTree) {
            subPathInFieldNameTree.push(pathInFieldNameTree[pInd]);
         }
         subPathInFieldNameTree.push(fieldName);
         
         var value = null;
         var field = fieldOrListField;
         var fieldType = fieldOrListField["dcmf:type"];
         var fieldOrListFieldType = fieldType;
         while (fieldOrListFieldType === 'list' || fieldOrListFieldType === 'i18n') {
            fieldOrListField = fieldOrListField['dcmf:listElementField'];
            fieldOrListFieldType = fieldOrListField["dcmf:type"];
         }
         
         if (subFieldNameTree !== null // else primitive (?)
               && typeof subFieldNameTree === 'object' // ex. {} ; typeof fieldOrListField["dcmf:type"] !== 'resource'
                  && subFieldNameTree['type'] ==='node') { // else leaf (primitive)
            
            if (fieldType === 'list' || fieldType === 'i18n') {
               // import 0, 1... nth list item (map or (embedded or not) resource) if defined in fieldNameTree import plan
               var listItemSubFieldNameTree;
               for (var listItemInd = 0; typeof (listItemSubFieldNameTree = subFieldNameTree[listItemInd + '']) !== 'undefined'; listItemInd++) {
                  var listItemValue = importMapOrResourceValue(fieldOrListField, resourceRow, listItemSubFieldNameTree,
                        mixin, fieldName, subPathInFieldNameTree, importState);
                  
                  if (listItemValue !== null) {
                     mixinHasValue = true;
                     var valueList = resource[fieldName];
                     if (typeof valueList === 'undefined') {
                        valueList = [];
                     }
                     // NB. to import without specifying language, use default language and don't specify listItemIndex
                     valueList.push(listItemValue);
                     resource[fieldName] = valueList; // must be set now else would be reput in a list
                  }
               }
            }
            
            // import regular map or (embedded or not) resource field
            value = importMapOrResourceValue(fieldOrListField, resourceRow, subFieldNameTree,
                  mixin, fieldName, subPathInFieldNameTree, importState);
         }
         
         if (value === null) {
            // looking for local value :
            // (including if (non sub)resource uri)
            // in column fieldOrListField["importconf:internalName"] or else fieldName
            
            var fieldInternalName = (typeof subFieldNameTree === 'undefined') ?
                  null : subFieldNameTree['importconf:internalName'];
            var unknownFieldInternalName = fieldInternalName === null || typeof fieldInternalName === 'undefined';
            
            if (!unknownFieldInternalName || topLevelResource) {
               if (!unknownFieldInternalName) {
                  value = resourceRow[fieldInternalName];
                  if (typeof value === 'undefined') { // look in fieldName column as failback
                     value = resourceRow[fieldName];
                  }
               } else { // if (topLevelResource) { // look in fieldName column
                  value = resourceRow[fieldName];
               }
               if (typeof value !== 'undefined') {
                  value = convertValue(value, fieldOrListField); // NB. empty becomes null
                  // NB. if null, means among imported fields but empty (!fieldHasValue), and default value will be set if any
                  if (value !== null && fieldOrListField['dcmf:type'] === 'resource' && value.indexOf('http') !== 0) {
                     importState.data.errors.push({ code : "resourceUriReadInCsvNotHttp",
                           mixin : typeName, field : fieldName, fieldOrListField : fieldOrListField, value : value,
                           message : "ERROR resourceUriReadInCsvNotHttp" });
                  }
               } else {
                  value = null;
                  if (!unknownFieldInternalName) {
                     importState.data.warnings.push({ code : "noColumnForFieldInternalName",
                           mixin : typeName, field : fieldName, fieldInternalName : fieldInternalName,
                           message : "Can't find column '" + fieldInternalName
                           + "' (field internal name) nor '" + fieldName
                           + "' for field " + fieldName + " in mixin " + typeName });
                  }
               }
            } // else not top level, so has to use an internal field name other than fieldName, so skipping import
            mixinHasValue = mixinHasValue || value !== null;

            
            if (value === null) {
               // trying auto linking :
               ////////////////////// NOO (only if no field internal name, else means it's meant to work this way, even when it disables autolinking)
               var resourceType = fieldOrListField["dcmf:resourceType"];
               if (fieldOrListFieldType === 'resource'
                     && importState.data.row.loopIndex !== 0 // else not all top level resources have been parsed yet so might be wrong
                     && modelTypeToRowResources != null // else within subresource call
                     && typeof subFieldNameTree !== 'undefined' // else import not planned, only in inherited field
                     && subFieldNameTree.type !== 'node' // else planned to be imported through dotted pathes
                     && resourceType !== typeName) { // itself (case of ex. node.parentNode)
                  var rowResource = findBestMatchingRowResourceForType(resourceType, modelTypeToRowResources, importState);
                  if (rowResource !== null) {
                     var uri = rowResource["@id"];
                     if (typeof uri !== 'undefined') { // avoiding incomplete rowResource
                        if (mixin['dcmo:isInstanciable']) { // resource ; TODO TODO better is subresource ex. storage(Path) == modelx/path ; typeof value !== 'undefined' && value != null && value.length != 0
                           value = uri;
                        } else { // map, TODO or subresource
                           value = rowResource;
                        }
                        mixinHasAutolinkedValue = mixinHasAutolinkedValue || value !== null;
                     } // else rowResource id may still be incomplete
                  } // else rowResource not yet parsed
               }
            }
            
         }
         
         if (value === null) {
            // set default value when not among imported fields (no internalName) :
            if (typeof subFieldNameTree !== 'undefined') {
               value = getDefaultValueIfAny(fieldOrListField, importState, subFieldNameTree['importconf:defaultStringValue']);
            } else {
               value = getDefaultValueIfAny(fieldOrListField, importState);
            }
            mixinHasDefaultValue = mixinHasDefaultValue || value !== null;
         }
         
         if (value !== null) {
            if (fieldType === 'list' || fieldType === 'i18n') {
               var valueList = resource[fieldName];
               if (typeof valueList === 'undefined') {
                  valueList = [];
               }
               if (fieldType === 'i18n' && typeof value === 'string') { // importing with default language without .v suffix
                  var defaultLanguage = field['dcmf:defaultLanguage']; // TODO also list of i18n !
                  if (typeof defaultLanguage === 'undefined') {
                     importState.data.errors.push({ code : "i18nWithoutLanguageNorDefaultOne",
                           mixin : mixin['dcmo:name'], fieldName : fieldName, path : subPathInFieldNameTree.join('.'),
                           message : "ERROR i18nWithoutLanguageNorDefaultOne" });
                     continue;
                  }
                  value = { l : defaultLanguage, v : value };
               }
               valueList.push(value);
               value = valueList;
            }
            resource[fieldName] = value;
         }
         
      } // end field loop
      
      if (typeof resource['@id'] === 'undefined' && typeName !== 'map') {
         // create or update resource :
           
         // build id :
         var id = null; // NB. id is encoded as URIs should be, BUT must be decoded before used as GET URI
         // because swagger.js re-encodes (per path element because __unencoded__-prefixed per hack)
         // out of fields
         var indexToEncodedValue = {};
         var parentIndexToEncodedValue = {};
         for (var idFieldName in enrichedModelOrMixinFieldMap) {
            var idField = enrichedModelOrMixinFieldMap[idFieldName];
            var indexInId = idField["dcmf:indexInId"]; // NB. this import-specific conf has been enriched in refreshed involvedMixins' global fields
            if (typeof indexInId === 'number') {
               var idValue = resource[idFieldName];
               if (typeof idValue === 'undefined' || idValue === null || idValue === "") {
                  //console.log("Missing value for id field " + idFieldName
                  //      + ", clearing others (" + Object.keys(indexToEncodedValue).length
                  //      + ") ; below " + pathInFieldNameTree + " in :");
                  //console.log(resource);
                  if (!(mixinHasValue
                        || mixinHasAutolinkedValue && importState.model.defaultRow['importAutolinkedOnly'] !== 'false' // autolinking not enough to build id ?
                        || mixinHasDefaultValue && importState.model.defaultRow['importDefaultOnly'] !== 'false')) {
                     return null; // ex. missing a yet unbuilt link ; nothing to import, skip resource
                     // NB. this way only the root cause is shown
                  }
                  importState.data.errors.push({ code : "missingValueForIdField", // TODO or warning since global error anyway ?
                        mixin : mixin['dcmo:name'], fieldName : idFieldName,
                        resource : resource, pathInFieldNameTree : pathInFieldNameTree,
                        message : "ERROR missingValueForIdField" });
                  return resource; // abort resource creation in this loop (don't add it to uri'd resources yet)
               }
               if (idField["dcmf:type"] === 'resource') { // getting ref'd resource id
                  var uri;
                  if (typeof idValue === 'string') { // resource
                     uri = idValue;
                  } else { // subresource
                     uri = idValue["@id"];
                     if (typeof uri === 'undefined') {
                        //console.log("Missing uri for resource id field " + idFieldName
                        //      + ", clearing others (" + Object.keys(indexToEncodedValue).length
                        //      + ") ; below " + pathInFieldNameTree + " in :");
                        console.log(resource);
                        importState.data.errors.push({ code : "missingUriForResourceIdField", // TODO or warning since global error anyway ?
                              mixin : mixin['dcmo:name'], fieldName : idFieldName, value : idValue,
                              resource : resource, pathInFieldNameTree : pathInFieldNameTree,
                              message : "ERROR missingUriForResourceIdField" });
                        return resource; // without adding it to uri'd resources
                     }
                  }
                  var iri = uri.replace(/^.*\/\/*dc\/type\/*/, ""); //uri.substring(uri.indexOf("/dc/type/") + 9);
                  var idEncodedValue = iri.substring(iri.indexOf("/") + 1);
                  indexToEncodedValue[indexInId] = {v : idEncodedValue, uri : uri };
               } else if (idField["dcmf:type"] === 'i18n') {
                  var defaultLanguage = getDefaultLanguage(idField, importState, mixin);
                  /*if (typeof defaultLanguage === 'undefined') {
                     importState.data.errors.push({ code : "i18nIsInIdButHasNoDefaultLanguage",
                           mixin : mixin['dcmo:name'], fieldName : idFieldName,
                           message : "ERROR i18nIsInIdButHasNoDefaultLanguage" });
                     return null;
                  }*/
                  var valueInLanguage = null;
                  for (var listInd in idValue) {
                     if (idValue[listInd].l === defaultLanguage) {
                        valueInLanguage = idValue[listInd].v;
                        break;
                     }
                  }
                  if (valueInLanguage === null) {
                     importState.data.warnings.push({ code : "i18nIsInIdButHasNoValueForDefaultLanguage",
                           mixin : mixin['dcmo:name'], fieldName : idFieldName, resource : resource,
                           defaultLanguage : defaultLanguage, pathInFieldNameTree : pathInFieldNameTree,
                           message : "ERROR i18nIsInIdButHasNoValueForDefaultLanguage" });
                     return null;
                  }
                  indexToEncodedValue[indexInId] = {v : encodeIdSaveIfNot(valueInLanguage + "", // convert to string (might be number)
                        idField) };
               } else {
                  indexToEncodedValue[indexInId] = {v : encodeIdSaveIfNot(idValue + "", // convert to string (might be number)
                        idField) };
               }
               
            }
            
            // checking if parent, for ancestors :
            if (importState.model.defaultRow['useIdForParent'] !== 'true') {
               var indexInParents = idField["dcmf:indexInParents"]; // NB. this import-specific conf has been enriched in refreshed involvedMixins' global fields ??????????????
               if (typeof indexInParents === 'number') {
                  var parentValue = resource[idFieldName];
                  if (typeof parentValue === 'undefined' || parentValue === null || parentValue === "") {
                     importState.data.errors.push({ code : "missingValueForParentField",
                           mixin : mixin['dcmo:name'], fieldName : idFieldName,
                           resource : resource, pathInFieldNameTree : pathInFieldNameTree,
                           message : "ERROR missingValueForParentField" });
                  } else {
                  
                  // NB. idField is a resource field, because checked at model parsing time
                  var uri;
                  if (typeof parentValue === 'string') { // resource
                     uri = parentValue;
                  } else { // subresource (refMixin ???)
                     uri = parentValue["@id"];
                     if (typeof uri === 'undefined') {
                        importState.data.errors.push({ code : "missingUriForResourceParentField",
                              mixin : mixin['dcmo:name'], fieldName : idFieldName, value : parentValue,
                              resource : resource, pathInFieldNameTree : pathInFieldNameTree,
                              message : "ERROR missingUriForResourceParentField" });
                        return resource; // without adding it to uri'd resources
                     }
                  }
                  parentIndexToEncodedValue[indexInParents] = { uri : uri };
                  
                  }
               }
            }
         }
         for (var idevInd in indexToEncodedValue) {
            var idValueElt = indexToEncodedValue[idevInd];
            if (id === null) {
               id = idValueElt.v;
            } else {
               id += "/" + idValueElt.v;
            }
         }

         // computing ancestors :
         var ancestors = null;
         if (contains(mixin["dcmo:globalMixins"], "o:Ancestor_0")) {
            // && mixin["dcmo:isInstanciable"] only if old "model" (already checked)
            ancestors = [];
         }
         for (var pevInd in parentIndexToEncodedValue) {
            var pValueElt = parentIndexToEncodedValue[pevInd];
            if (ancestors !== null // else not an o:Ancestor_0
                  && typeof pValueElt.uri !== 'undefined') { // else itself (added later), rather than another resource
               var ancestor = importState.data.resources[pValueElt.uri];
               // TODO check if ancestor not known (ex. string resource reference...)
               if (typeof ancestor === 'undefined') {
                  ancestors = null; // reset since incomplete
                  importState.data.errors.push({ code : "cantFindAncestorAmongParsedResources",
                        resource : resource, ancestorUri : pValueElt.uri,
                        pathInFieldNameTree : pathInFieldNameTree });
               } else if (!hasMixin(ancestor["@type"][0], "o:Ancestor_0", importState)) {
                  ancestors = null; // reset since incomplete ; TODO or accept as its own single ancestor ?
                  importState.data.errors.push({ code : "ancestorHasNotAncestorMixin",
                     resource : resource, ancestor : ancestor, pathInFieldNameTree : pathInFieldNameTree });
               } else {
                  var ancestorAncestors = ancestor["o:ancestors"];
                  if (typeof ancestorAncestors === 'undefined') {
                     ancestors = null; // reset since incomplete
                     importState.data.errors.push({ code : "ancestorHasNotDefinedAncestors",
                        resource : resource, ancestor : ancestor, pathInFieldNameTree : pathInFieldNameTree });
                  } else {
                     for (var aInd in ancestorAncestors) {
                        ancestors.push(ancestorAncestors[aInd]);
                     }
                  }
               }
            }
         }
         
         if (id === null) { // scripted id
            var idGenJs = mixin["dcmo:idGenJs"];
            if (typeof idGenJs === 'string' && idGenJs.length != 0) {
               var r = resource;
               id = encodeURI(decodeURI(eval(idGenJs))); // in case idGenJs forgot do encode (per path element)
            }
         }
         
         if (id === null) { // CUSTOM
            // sample :
            /*if (typeName === 'elec:City_0') {
               id = encodeURI(resourceRow["inseeville"]) + '/' + encodeURI(resourceRow["numero_electeur"]); // TODO TODO !!! in second pass ??
            }*/
         }
         
         if (id === null) {
            importState.data.warnings.push({ code : "noConfForId",
                  mixin : typeName, row : resourceRow,
                  message : "No conf for id, using custom gen - in mixin "
                  + typeName + " and resourceRow " + resourceRow });
            return null;
         }
         
         var uri = buildUri(typeName, id);
         // NB. uri is encoded as URIs should be, BUT must be decoded before used as GET URI
         // because swagger.js re-encodes (per path element because __unencoded__-prefixed per hack)
         var existingResource = importState.data.resources[uri];
         // TODO TODO subresource case
         if (typeof existingResource === 'undefined') {
            resource["@id"] = uri; // WARNING is wrong if !dcmo:isInstanciable, but id may be right (else requires key fields linking)
            //resource["o:version"] = -1;
            resource["@type"] = [ typeName ];
            if (ancestors !== null && mixin['dcmo:isInstanciable']) {
               ancestors.push(uri); // itself, but only if dcmo:isInstanciable, else added at instance building elsewhere 
               resource["o:ancestors"] = ancestors;
            }
            // NB. added by caller, at top (row) or subresource import level, depending on embedded or not
            return resource;
         } else {
            // merge (this mixin's found values) over existing resource :
            // also list (primitives as sets, LATER beyond id / key subfields should be used), i18n, map & embedded subresource
            mergeValues(existingResource, resource, mixin["dcmo:globalFields"], importState); // works for fields but also native fields ex. modified...
            // NB. ancestors, type & uri have already been built and set at creation
            return existingResource;
         }
      }
      return resource;
   }
           
   function csvToData(resultsData, importState) {
      var internalFieldNames = importState.data.internalFieldNames;
      var involvedMixins = importState.data.involvedMixins;
      var rLength = Math.min(resultsData.length, getResourceRowStart() + getResourceRowLimit());
      importState.data.rowNb = 0;
      for (var rInd = getResourceRowStart(); rInd < rLength ; rInd++) {
         importState.data.rowNb++; // nb. rInd is string
        console.log("row " + rInd);//
        ///var importStateRowData = {};
        ///importState.data.push(importStateRowData);
        // TODO by push / step
        importState.data.row = {
              loopIndex : 0,
              resourceRow : resultsData[rInd + ''], // convert to string !!
              modelTypeToRowResources : {},
              missingIdFieldResourceOrMixins : null
        };
        
        // mixins loop :
        var previousMissingIdFieldResourceOrMixinNb = -1;
        var previousGlobalErrors = importState.data.errors;
        var previousGlobalWarnings = importState.data.warnings;
        do {
           importState.data.row.missingIdFieldResourceOrMixins = []; // NB. fastest way to empty an array
           importState.data.errors = []; // clearing, only keeping last (& cleanest) one
           importState.data.warnings = []; // clearing, only keeping last (& cleanest) one
           //console.log("row mixins loop " + importState.data.row.loopIndex + " " + importState.data.row.missingIdFieldResourceOrMixins);//
        
        var importedResource;
        for (var mInd in involvedMixins) {
             // for each mixin, find its values in the current row :
             var mixin = involvedMixins[mInd];
             
             if (!mixin["dcmo:isInstanciable"]) {
                continue; // don't import models that are strictly mixins ex. o:Ancestor_0 or geo:Area_0
             }
             
             try {
             importedResource = csvRowToDataResource(mixin, importState.data.row.resourceRow, null,
                   [ mixin["dcmo:name"] ], importState.data.row.modelTypeToRowResources, importState);
             } catch (e) {
                if (importState.aborted) {
                   abortImport();
                } else {
                   abortImport(e);
                }
                return;
             }
             
             if (importedResource == null) {
                // nothing to import (or only autolinked values), skip resource
             } else if (typeof importedResource["@id"] === 'undefined') {
                //console.log(JSON.stringify(importedResource, null, null));//
                importState.data.row.missingIdFieldResourceOrMixins.push(importedResource);
             } else {
                // adding it :
                importState.data.resources[importedResource['@id']] = importedResource;
                if (importState.data.row.modelTypeToRowResources != null) {
                   importState.data.row.modelTypeToRowResources[mixin['dcmo:name']] = importedResource; // in case not yet there
                }
             }
        }

           if (importState.data.row.missingIdFieldResourceOrMixins.length // size equality enough if involvedMixins don't change
                      == previousMissingIdFieldResourceOrMixinNb || importState.data.row.loopIndex > 20) {
              importState.data.errors.push({ code : "missingIdFields",
                 /*resources : importState.data.row.missingIdFieldResourceOrMixins, */row : importState.data.row.resourceRow });
              console.log("csvToData loop aborted, still missing id fields in resources :\n"
                    + JSON.stringify(importState.data.row.missingIdFieldResourceOrMixins, null, "\t")
                    + "\n   in resourceRow :\n" + JSON.stringify(importState.data.row.resourceRow, null, null));
              //console.log("   with resources " + JSON.stringify(resources, null, null));
              break;
           }
           previousMissingIdFieldResourceOrMixinNb = importState.data.row.missingIdFieldResourceOrMixins.length;
           importState.data.row.loopIndex++;
        
        } while (importState.data.row.missingIdFieldResourceOrMixins.length != 0);

        for (var i in importState.data.errors) {
           previousGlobalErrors.push(importState.data.errors[i]);
        }
        importState.data.errors = previousGlobalErrors;
        for (var i in importState.data.warnings) {
           previousGlobalWarnings.push(importState.data.warnings[i]);
        }
        importState.data.warnings = previousGlobalWarnings;
        
        ///importStateRowData["loops"] = importState.data.row.loopIndex + 1;
        ////importStateRowData["errors"] = errors;

        if (importState.data.rowNb % 1000 == 1) { // or 100 ? TODO yield !!
           $('.resourceRowCounter').html("Handled <a href=\"#importedJsonFromCsv\">" + importState.data.rowNb + " rows</a>");
        }
     }

      displayParsedResource(importState);
      
      function importedDataPosted(resourceOrData, origResources) {
         var done = importedResourcePosted(resourceOrData, importState.data.posted, importState,
               "resource", $('.resourceCounter'), origResources);
         if (done) {
            concludeImport();
         }
      }
      importState.data.posted.toBePostedNb = Object.keys(importState.data.resources).length;
      for (var uri in importState.data.resources) {
         if (importState.aborted) {
            return abortImport();
         }
         
         // TODO mass version update !
         var relativeUrl = uri.substring(uri.indexOf("/dc/type/"));
         getData(relativeUrl, function (returnedResource) {
            // updating existing resource : 
            // NB. can't access original "resource" variable because has been changed since call is async
            var upToDateResourceUri = returnedResource["@id"]; // ex. "http://data.oasis-eu.org/dc/type/geo%3ACityGroup_0/FR/CC%20les%20Ch%C3%A2teaux"
            var upToDateResource = importState.data.resources[upToDateResourceUri];
            upToDateResource["o:version"] = returnedResource["o:version"];
            var resourceIri = upToDateResourceUri.substring(upToDateResourceUri.indexOf("/dc/type/") + "/dc/type/".length); // ex. "geo%3ACityGroup_0/FR/CC%20les%20Ch%C3%A2teaux"
            var modelType = decodeURIComponent(resourceIri.substring(0, resourceIri.indexOf("/"))); // ex. geo:CityGroup_0
            //var resourceId = decodeURIComponent(resourceIri.substring(resourceIri.indexOf("/") + 1));
            postAllDataInType(modelType, upToDateResource,
                  importedDataPosted, importedDataPosted);
         }, function (data) {
            // creating new resource :
            var resourceIri = data.request.path.replace(/^\/*dc\/type\/*/, ""); // ex. "geo%3ACityGroup_0/FR/CC%20les%20Ch%C3%A2teaux"
            var modelType = decodeURIComponent(resourceIri.substring(0, resourceIri.indexOf("/"))); // ex. geo:CityGroup_0
            // BUT don't decode URI !! (or use decoded resourceId to build URI)
            //var resourceId = decodeURIComponent(resourceIri.substring(resourceIri.indexOf("/") + 1)); // ex. "FR/CC les Châteaux"
            //var upToDateResourceUri = dcConf.containerUrl + "dc/type/" + modelType + "/" + resourceId;
            var upToDateResourceUri = dcConf.containerUrl + "dc/type/" + resourceIri;
            var upToDateResource = importState.data.resources[upToDateResourceUri];
            postAllDataInType(modelType, upToDateResource,
                  importedDataPosted, importedDataPosted);
         });
      }
  }
   function displayParsedResource(importState) {
      $('.resourceRowCounter').html("Handled <a href=\"#importedJsonFromCsv\">" + importState.data.rowNb
            + " rows</a> (<a href=\"#datacoreResources\">" + importState.data.errors.length + " errors</a>)");
      if (importState.data.errors.length != 0) {
         //$('.mydata').html(
         $('.importedResourcesFromCsv').html("<b>Errors :</b><br/>"
               + JSON.stringify(importState.data.errors, null, '\t').replace(/\n/g, '<br>')
               + "<br/><br/><b>Warnings :</b><br/>"
               + JSON.stringify(importState.data.warnings, null, '\t').replace(/\n/g, '<br>'));
         
      } else {
         // display full resources only if no errors to display :
         //var resourcesPrettyJson = JSON.stringify(resources, null, '\t').replace(/\n/g, '<br>');
         var resourcesPrettyJson = toolifyDcResource(importState.data.resources, 0);
         $('.importedResourcesFromCsv').html(resourcesPrettyJson);
      }
   }
  
   function getResourceRowLimit() {
      var resourceRowLimit = parseInt($(".resourceRowLimit").val(), 10);
      if (typeof resourceRowLimit === 'number') { // && resourceRowLimit < 500
         return resourceRowLimit;
      }
      return 50;
   }
   function getResourceRowStart() {
      var resourceRowStart = parseInt($(".resourceRowStart").val(), 10);
      if (typeof resourceRowStart === 'number' && resourceRowStart > 0) { // && resourceRowStart < 50000
         return resourceRowStart;
      }
      return 0;
   }
   function resetResourceCounters() {
      $('.resourceRowCounter').html("Handled no resource row yet");
      $('.resourceCounter').html("Posted no resource yet");
   }
   
   function fillData(importState) {
      if (getResourceRowLimit() == 0) {
         return;
      } // else > 0, or -1 means all ; or 
      
      resetResourceCounters();
      //console.log("fillData");//
      var resourceParsingConf = {
            download: true,
            header: true,
            preview: getResourceRowStart() + getResourceRowLimit() + 1, // ex. '1' user input means importing title line + 1 more line
            complete: function(results) {
               console.log("Remote file parsed!", results);
               ///var results = eval('[' + data.content.data + ']')[0];
               var prettyJson = JSON.stringify(results.data, null, '\t').replace(/\n/g, '<br>');
               $('.importedJsonFromCsv').html(prettyJson);
               // TODO handle errors...

               var involvedMixins = importState.data.involvedMixins;
               
               var dataColumnNames = results.meta.fields;
               importState.data["dataColumnNames"] = dataColumnNames;
               
               // imported field names
               // adding field names with internal field name :
               var importedFieldNames = [];
               var fieldNamesWithInternalNameMap = importState.model.fieldNamesWithInternalNameMap;
               for (var fnInd in fieldNamesWithInternalNameMap) {
                  importedFieldNames.push(fnInd);
               }
               // adding prefixed data column names :
               for (var dcnInd in dataColumnNames) {
                  var dataColumnName = dataColumnNames[dcnInd];
                  if (dataColumnName.indexOf(':') !== -1 && fieldNamesWithInternalNameMap[dataColumnName] === null) {
                     importedFieldNames.push(dataColumnName);
                  }
               }
               importState.data["importedFieldNames"] = importedFieldNames;
               
               // BEWARE limited to 10 by default !!!!!! and 100 max !!
      	      findDataByType("/dc/type/dcmo:model_0?dcmo:globalFields.dcmf:name=$in"
      	            // globalFields else won't get ex. CountryFR inheriting from Country but with no additional field (??)
                     + JSON.stringify(importState.data.importedFieldNames, null, null), function(fieldNameMixinsFound) {
                     if (fieldNameMixinsFound.length === 100) { // max limit
                        return abortImport("Too many mixins (>= 100) found for field names to import");
                     }
                     
                     for (var fnmInd in fieldNameMixinsFound) {
                        var involvedMixin = fieldNameMixinsFound[fnmInd];
                        var modelOrMixin = importState.model.modelOrMixins[involvedMixin["dcmo:name"]];
                        if (typeof modelOrMixin === 'undefined') {
                           continue; // not used, ex. unused mixin that inherits a used field
                        }
                        involvedMixins.push(involvedMixin);
                        
                        // global mixins :
                        modelOrMixin["dcmo:globalMixins"] = involvedMixin["dcmo:globalMixins"];
                        // global fields :
                        var involvedMixinFieldArray = involvedMixin["dcmo:globalFields"];
                        var modelOrMixinLocalFieldMap = modelOrMixin["dcmo:fields"];
                        var enrichedModelOrMixinFieldMap = {};
                        importState.model.modelOrMixins[involvedMixin["dcmo:name"]]["dcmo:globalFields"] = enrichedModelOrMixinFieldMap;
                        for (var fInd in involvedMixinFieldArray) {
                           var involvedMixinField = involvedMixinFieldArray[fInd];
                           var fieldName = involvedMixinField["dcmf:name"];
                           var enrichedModelOrMixinField = modelOrMixinLocalFieldMap[fieldName];
                           if (typeof enrichedModelOrMixinField !== 'undefined') {
                              // let's enrich the refreshed involvedMixin with import data it doesn't know about :
                              for (var fieldKey in enrichedModelOrMixinField) {
                                 if (typeof involvedMixinField[fieldKey] === 'undefined') { // ex. "importconf:internalName"
                                    involvedMixinField[fieldKey] = enrichedModelOrMixinField[fieldKey];
                                 }
                              }
                           } // else ex. field not local
                           // let's add it as global fields in the modelOrMixin shortcuts :
                           enrichedModelOrMixinFieldMap[fieldName] = involvedMixinField;
                        }
                     }
                     
                     csvToData(results.data, importState);
               }, null, 0, 100); // max limit (else 10 !!!)
            }
      }
      if ($(".resourceFile").val() != "") {
         $(".resourceFile").parse({ config : resourceParsingConf });
      } else {
         Papa.parse("samples/openelec/electeur_v26010_sample.csv?reload="
               + new Date().getTime(), resourceParsingConf); // to prevent browser caching
      }
   }
  
   function importField(fieldRow, fieldName, mixinFields, mixinTypeName, importState) {
      var field = mixinFields[fieldName];
      if (typeof field === 'undefined') {
         var fieldUri = buildUri("dcmf:field_0", mixinTypeName + "/" + fieldName); // TODO map & sub sub resource
         var fieldDataType = fieldRow["Data type"];
         var fieldType = importState.typeMap[fieldDataType.toLowerCase()];
         if (typeof fieldType === 'undefined') {
            fieldType = "resource";
         }
         var fieldOrListField = {
               "dcmf:name" : fieldName, // TODO prefix, case
               "@id" : fieldUri,
               "o:version" : 0, // TODO top level's ?
               "@type" : [ "dcmf:field_0" ], // TODO version, default one ?
               "dcmf:type" : (fieldType === 'i18n') ? 'map' : fieldType,
         }; // TODO prefixes, case, version
         
         // TODO case
         if (fieldType === "map") {
            fieldOrListField["dcmf:mapFields"] = {};
         } else if (fieldType === "resource") {
            fieldOrListField["dcmf:resourceType"] = buildMixinName(fieldDataType, importState);
         }
         if (convertMap["boolean"](fieldRow["Multiple"]) || fieldType === 'i18n') {
            field = {
                  "dcmf:name" : fieldName, // TODO prefix, case
                  "@id" : fieldUri,
                  "o:version" : 0, // TODO top level's ?
                  "@type" : [ "dcmf:field_0" ], // TODO version, default one ?
                  "dcmf:type" : (fieldType === 'i18n') ? fieldType : "list",
                  "dcmf:listElementField" : fieldOrListField
            }; // TODO prefixes, case, version
            if (fieldType === 'i18n') {
               fieldOrListField['dcmf:mapFields'] = {
                     'l' : {
                        "dcmf:name" : 'l', // TODO prefix, case
                        "@id" : fieldUri + '/l', // ??
                        "o:version" : 0, // TODO top level's ?
                        "@type" : [ "dcmf:field_0" ], // TODO version, default one ?
                        "dcmf:type" : 'string',
                     },
                     'v' : {
                        "dcmf:name" : 'v', // TODO prefix, case
                        "@id" : fieldUri + '/l', // ??
                        "o:version" : 0, // TODO top level's ?
                        "@type" : [ "dcmf:field_0" ], // TODO version, default one ?
                        "dcmf:type" : 'string',
                     }
               };
            }
         } else {
            field = fieldOrListField;
         }
         // adding it :
         mixinFields[fieldName] = field;
         // TODO trim...
         // TODO checks...
         // TODO also format ex. date
      } // else TODO (LATER) conflicts & merge...

      // more init :
      if (field["dcmf:type"] === "list") {
         var listElementField = field["dcmf:listElementField"];
         mergeStringValueOrDefaultIfAny(listElementField, "dcmf:required", fieldRow["required"],
               importState.metamodel["dcmf:field_0"], importState); // meaningless for list but required by ModelResourceMappingService for now
         mergeStringValueOrDefaultIfAny(listElementField, "dcmf:queryLimit", fieldRow["queryLimit"], importState.metamodel["dcmf:field_0"], importState);
      }
      
      mergeStringValueOrDefaultIfAny(field, "dcmf:required", fieldRow["required"], importState.metamodel["dcmf:field_0"], importState);
      mergeStringValueOrDefaultIfAny(field, "dcmf:queryLimit", fieldRow["queryLimit"],
            importState.metamodel["dcmf:field_0"], importState); // meaningless for list but required by ModelResourceMappingService for now
      mergeStringValueOrDefaultIfAny(field, "dcmf:isInMixinRef", fieldRow["isInMixinRef"],
            importState.metamodel["dcmf:field_0"], importState); // meaningless for list but required by ModelResourceMappingService for now
      mergeStringValueOrDefaultIfAny(field, "dcmf:indexInId", fieldRow["indexInId"], importState.metamodel["dcmf:field_0"], importState);
      mergeStringValueOrDefaultIfAny(field, "dcmf:indexInParents", fieldRow["indexInParents"], importState.metamodel["dcmf:field_0"], importState);
      if (field['dcmf:indexInParents'] && field['dcmf:type'] !== 'resource') {
         importState.model.errors.push({ code : "indexInParentsFieldIsNotResource",
            mixin : mixinTypeName, field : field });
      }
      mergeStringValueOrDefaultIfAny(field, "dcmf:defaultStringValue", fieldRow["defaultValue"], importState.metamodel["dcmf:field_0"], importState);
      mergeStringValueOrDefaultIfAny(field, "dcmf:defaultLanguage", fieldRow["defaultLanguage"], importState.metamodel["dcmf:field_0"], importState);
      
      // import conf-specific (not in server-side model) :
      // NB. importconf:internalName & defaultValue are in fieldNameTree import plan
      mergeImportConfStringValue(field, "importconf:dontEncodeIdInUri", fieldRow["dontEncodeIdInUri"], "boolean");
      mergeImportConfStringValue(field, "importconf:evalAsJs", fieldRow["jsToEval"], "string");
      
      // for app.js / openelec (NOT required) :
      var description = trimIfAnyElseNull(fieldRow["Description"]);
      var precision = trimIfAnyElseNull(fieldRow["Precision"]);
      if (description != null || precision != null) {
         var doc = "";
         if (description != null) {
            doc += description;
            if (precision != null) {
               doc += " " + precision;
            }
         } else {
            doc += precision;
         }
         var existingDoc = field["dcmf:documentation"];
         if (typeof existingDoc === 'undefined' || existingDoc == null) {
            field["dcmf:documentation"] = doc;
         }
      }
      /*if (!field["dcmf:isInMixinRef"]) {
         field["dcmf:isInMixinRef"] = fieldRow["isInMixinRef"] === "true" // TODO : compute ??
      }
      var indexInIdString = trimIfAnyElseNull(fieldRow["indexInId"]);
      if (indexInIdString !== null) {
         if (typeof field["dcmf:indexInId"] === 'undefined' || field["dcmf:indexInId"] == null) {
            field["dcmf:indexInId"] = new Number(indexInIdString); // TODO : compute
         }
      }
      setTrimIfAny(field, "dcmf:defaultStringValue", fieldRow["defaultValue"]); // TODO for other apps...
      setTrimIfAny(field, "importconf:internalName", fieldRow["Internal field name"]); // TODO for other apps...
      // TODO if 'undefined' throw bad import conf
      */
      return field;
   }
   
   function buildMixinName(mixinName, importState) {
      // TODO case
      if (mixinName.indexOf(":") == -1) {
         mixinName = importState.domainPrefix + ":" + mixinName; // NO . else KO in query (and tree path parsing)
      }
      if (mixinName.indexOf("_") == -1) {
          mixinName = mixinName + "_" + importState.mixinMajorVersion; // NO . else KO in query (and tree path parsing)
      }
      return mixinName;
   }
   
   function isInteger(n) {
      return !isNaN(parseInt(n)) && isFinite(n);
   }
   
   var mixinTypeName = "dcmo:model_0";
   // callback(mixins, mixinNameToFieldNameTree)
   function csvToModel(resultsData, importState, callback) {
      var mixinNameToFieldNameTree = importState.model.mixinNameToFieldNameTree;
      var mixins = importState.model.modelOrMixins;
        
      var loopMaxIndex = 20;
      var loopIndex = -1;
      do {
         importState.model.errors = [];
         if (loopIndex > loopMaxIndex) {
            break;
         }
         loopIndex++;
        
        
        // import plan (& internalName) :
        fieldsLoop : for (var fInd in resultsData) {
           if (importState.aborted) {
              return abortImport();
           }
           
           var fieldRow = resultsData[fInd];
           var mixinName = fieldRow["Mixin"];
           if (typeof mixinName === 'undefined' || mixinName === null || mixinName.trim().length === 0) {
              if (Object.keys(importState.model.defaultRow).length === 0) { // no defaultRow yet
                 importState.model.defaultRow = fieldRow; // use empty mixin & field for generic default values
              }
              continue; // skipping import
              // TODO LATER use empty field row for mixin values
           }
           if (mixinName.indexOf('//') === 0 || mixinName.indexOf('#') === 0) {
              continue; // skipping comment line, TODO rm should be done auto by papaparse comments = true
           }
           mixinName = buildMixinName(fieldRow["Mixin"], importState); // TODO case

           var fieldPath = fieldRow["Field name"];
           var fieldPathElements = fieldPath.split("."); // at least one
           
           var mixin = mixins[mixinName];
           ///var isModel = !convertMap["boolean"](fieldRow["Is Mixin"]);
           if (typeof mixin == 'undefined') {
              mixin = {
                 "dcmo:name" : mixinName,
                 "dcmo:pointOfViewAbsoluteName" : importState.projectAbsoluteName, // TODO LATER + pointOfViewName + '.' + pointOfViewEltName 
                 "@id" : buildUri(mixinTypeName, mixinName),
                 "@type" : [ mixinTypeName ], // NB. there are others but they will be recomputed on server side anyway
                 // more init :
                 "dcmo:majorVersion" : importState.mixinMajorVersion,
                 "dcmo:fields" : {},
              };
              mixins[mixinName] = mixin;
           }
           var mixinFields = mixin["dcmo:fields"];
           
           // POLY
           mergeStringValueOrDefaultIfAny(mixin, "dcmo:isDefinition", fieldRow["isDefinition"],
                 importState.metamodel["dcmo:model_0"], importState, importState.model.defaultRow['isDefinition']); // TODO required
           mergeStringValueOrDefaultIfAny(mixin, "dcmo:isStorage", fieldRow["isStorage"],
                 importState.metamodel["dcmo:model_0"], importState, importState.model.defaultRow['isStorage']); // TODO required
           mergeStringValueOrDefaultIfAny(mixin, "dcmo:isInstanciable", fieldRow["isInstanciable"],
                 importState.metamodel["dcmo:model_0"], importState, importState.model.defaultRow['isInstanciable']); // TODO required
           
           mergeStringValueOrDefaultIfAny(mixin, "dcmo:documentation", fieldRow["documentation"], importState.metamodel["dcmo:model_0"], importState); // TODO required
           mergeStringValueOrDefaultIfAny(mixin, "dcmo:mixins", fieldRow["Has Mixins"], importState.metamodel["dcmo:model_0"], importState);
           mergeStringValueOrDefaultIfAny(mixin, "dcmo:fieldAndMixins", fieldRow["fieldAndMixins"], importState.metamodel["dcmo:model_0"], importState);
           
              // storage-level fields : (if not storage nor instanciable, might be used by inheriting models)
              mergeStringValueOrDefaultIfAny(mixin, "dcmo:maxScan", fieldRow["maxScan"], importState.metamodel["dcmo:model_0"], importState);
              mergeStringValueOrDefaultIfAny(mixin, "dcmo:isHistorizable", fieldRow["isHistorizable"], importState.metamodel["dcmo:model_0"], importState);
              mergeStringValueOrDefaultIfAny(mixin, "dcmo:isContributable", fieldRow["isContributable"], importState.metamodel["dcmo:model_0"], importState);
              
              // TODO any other DCModel field

           // filling import plan :
           var rootMixinName = mixinName;
           var fieldNameTreeCur = mixinNameToFieldNameTree[rootMixinName];
           if (typeof fieldNameTreeCur === 'undefined') {
              fieldNameTreeCur = {};
              mixinNameToFieldNameTree[rootMixinName] = fieldNameTreeCur;
           }
           var field = null;
           var subFieldType = null;
           var subFieldOrListField = null;
           var subFieldOrListFieldType = null;
           var candidateMixin;
           for (var i = 0; i < fieldPathElements.length - 1 ; i++) {
              var fieldName = fieldPathElements[i];

              if (!((subFieldType === 'list' || subFieldType ===  'i18n') && subFieldOrListFieldType === 'map' && isInteger(fieldName))) {
              
              if (fieldName.indexOf(":") == -1) {
                 var fieldMixinPrefix = mixin["dcmo:name"].replace(":", "_").replace("_" + importState.mixinMajorVersion, ""); // TODO better domainPrefix + "_" + mixinShortName; // NO . else KO in query (and tree path parsing)
                 fieldName = fieldMixinPrefix + ":" + fieldName; // buildFieldName()
              }
              // TODO fieldName from this short name
              // following the link in the model :
              subFieldOrListField = mixinFields[fieldName];
              if (typeof subFieldOrListField === 'undefined') {
                 // TODO error field must be defined in first pass NOO TODO TODO TODO TODO
                 importState.model.errors.push({ code : "missingSubFields", mixin : rootMixinName, field : fieldPath,
                       intermediateMixin : mixin, subFieldOrListField : fieldName }); // setting up another loop on fields
                 continue fieldsLoop;
              }
              
              subFieldType = importState.typeMap[subFieldOrListField["dcmf:type"].toLowerCase()];
              subFieldOrListFieldType = subFieldType;
              while (subFieldOrListFieldType === 'list' || subFieldOrListFieldType === 'i18n') {
                 // skip list (of list...)
                 subFieldOrListField = subFieldOrListField['dcmf:listElementField'];
                 subFieldOrListFieldType = importState.typeMap[subFieldOrListField["dcmf:type"].toLowerCase()];
              }
              
              if (subFieldOrListFieldType === 'map') {
                 mixinFields = subFieldOrListField["dcmf:mapFields"];
                 if (typeof mixinFields === 'undefined') {
                    mixinFields = {};
                    subFieldOrListField["dcmf:mapFields"] = mixinFields;
                 }
              } else if (subFieldOrListFieldType === 'resource') {
                 var subFieldResourceType = subFieldOrListField["dcmf:resourceType"];
                 candidateMixin = mixins[subFieldResourceType];
                 if (typeof candidateMixin === 'undefined') {
                    // TODO error mixin must be defined in first pass NOO TODO TODO TODO TODO
                    importState.model.errors.push({ code : "missingReferencedMixins", mixin : rootMixinName,
                          field : fieldPath, intermediateMixin : mixin, subfield : fieldName,
                          resourceType : subFieldResourceType }); // setting up another loop on fields
                    continue fieldsLoop;
                 }
                 mixin = candidateMixin;
                 mixinFields = mixin["dcmo:fields"];
              } else if (typeof subFieldType !== 'undefined') {
                 importState.model.errors.push({ code : "notMapOrResourceTypedFieldBeforeEndOfDottedPath", mixin : rootMixinName,
                       field : fieldPath, intermediateMixin : mixin, subField : fieldName,
                       subFieldType : subFieldOrListFieldType }); // setting up another loop on fields
                 continue fieldsLoop;
              }
              
              }
              
              // following the link in the import plan :
              var subFieldNameTreeCur = fieldNameTreeCur[fieldName];
              if (typeof subFieldNameTreeCur !== 'object' || subFieldNameTreeCur == null) { // null meaning resource field or first pass happened
                 subFieldNameTreeCur = {};
                 fieldNameTreeCur[fieldName] = subFieldNameTreeCur;
              }
              subFieldNameTreeCur['type'] = 'node';
              fieldNameTreeCur = subFieldNameTreeCur;
           }
           
           // last field path element :
           var fieldName = fieldPathElements[fieldPathElements.length - 1];
           
           if (!((subFieldType === 'list' || subFieldType ===  'i18n') && subFieldOrListFieldType === 'map' && isInteger(fieldName))) {
           
           if (fieldName.indexOf(":") == -1 && subFieldType !== 'i18n') {
              var fieldMixinPrefix = mixin["dcmo:name"].replace(":", "_").replace("_" + importState.mixinMajorVersion, ""); // TODO better ; NO "." else KO in query (and tree path parsing)
              fieldName = fieldMixinPrefix + ":" + fieldName; // buildFieldName()
           }
           // will be filled once field is built
           
              field = importField(fieldRow, fieldName, mixinFields, mixinTypeName, importState);
           } // else can be skipped, map listElementField already defined

           // import plan-specific (not in server-side model nor generic field import conf) :
           if (typeof fieldNameTreeCur[fieldName] !== 'object') { // ex. 'undefined' or {} (should not happen ?)
              fieldNameTreeCur[fieldName] = { type:'leaf' };
              mergeImportConfStringValue(fieldNameTreeCur[fieldName], 'importconf:internalName',
                    fieldRow["Internal field name"].trim(), // else can't find ex. OpenElec "code_departement_naissance " !!
                    "string");
              mergeImportConfStringValue(fieldNameTreeCur[fieldName], 'importconf:defaultStringValue',
                    fieldRow["defaultValue"], "string");
              if (fieldNameTreeCur[fieldName]['importconf:internalName'] !== null) {
                 importState.model.fieldNamesWithInternalNameMap[fieldName] = null; // used as a set
              }
           } // else may have already been seen within fieldPath
           
           // TODO also mixins, resource links & sub...
        }
        
      } while (importState.model.errors.length != 0);

      importState.model["loops"] = loopIndex + 1;
        
        // CUSTOM or import models (and not fields)
        // TODO OR RATHER binding than script ??!
        //mixins["elec:Canton_0"]["dcmo:idGenJs"] = "";
        //mixins["elec:ElectoralList_0"]["dcmo:idGenJs"] = "";
        //mixins["elec:Elector_0"]["dcmo:idGenJs"] = "'fr' + '/' + r['elec:City_0:CityINSEECode'] + '/' + r['elec_Elector:ElectorNumberInTheCity']";
        //mixins["elec:PollingStation_0"]["dcmo:idGenJs"] = "r['elec_PollingStation:PollingStationID']";
        //mixins["elec:Street_0"]["dcmo:idGenJs"] = ""; // NOOO mixin ; TODO id (?)
        if (typeof mixins["elec:City_0"] !== 'undefined') mixins["elec:City_0"]["dcmo:idGenJs"] = "'/' + r['elec_City:CityINSEECode'] + '/' + r['elec_City:CityName']";
        //mixins["elec:Department_0"]["dcmo:idGenJs"] = ""; // link only
        if (typeof mixins["elec:Country_0"] !== 'undefined') mixins["elec:Country_0"]["dcmo:idGenJs"] = "'fr'"; // NOOO foreigners
        
        // making arrays of fields, fieldAndMixins, mixins :
        var modelArray = [];
        for (var mInd in mixins) {
            var mixin = mixins[mInd];
            
            // copy mixin to array element :
            var modelArrayElt = {};
            for (var key in mixin) {
               if (key.lastIndexOf("importconf:", 0) === 0) { // startsWith
                  continue; // skip import-only fields that are not defined in server
               }
               modelArrayElt[key] = mixin[key];
            }
            modelArray.push(modelArrayElt);
            
            var fieldAndMixinNames = []; // fieldAndMixins (orders their overrides)
            for (var mKey in mixin["dcmo:mixins"]) {
               var mixinName = mixin["dcmo:mixins"][mKey];
               fieldAndMixinNames.push(mixinName);
            }
            var fieldArray = [];
            fieldsToArray(mixin["dcmo:fields"], fieldArray);
            var fields = mixin["dcmo:fields"];
            modelArrayElt["dcmo:fields"] = fieldArray;
            for (var fInd in fieldArray) {
               fieldAndMixinNames.push(fieldArray[fInd]['dcmf:name']);
            }
            // TOOO LATER also mixins in fieldAndMixinNames
            modelArrayElt["dcmo:fieldAndMixins"] = fieldAndMixinNames;
            mixin["dcmo:fieldAndMixins"] = fieldAndMixinNames; // enriching
        }
        importState.model["modelArray"] = modelArray;
        
        displayImportedModels(importState);

      callback(importState);
   }
   function displayImportedModels() {
      ///var results = eval('[' + data.content.data + ']')[0];
      //var prettyJson = toolifyDcResource(results, 0);
      //var mixinsPrettyJson = JSON.stringify(modelArray, null, '\t').replace(/\n/g, '<br>');
      var mixinsPrettyJson = toolifyDcList(importState.model.modelArray, 0, null, 'dcmo:model_0');
      $('.importedResourcesFromCsv').html(mixinsPrettyJson);
   }
   
   function fieldsToArray(fields, fieldArray) {
      for (var fieldName in fields) {
         var field = fields[fieldName];
         // copy field to clean it up from import conf :
         var cleanField = fieldToCleanField(field);
         fieldArray.push(cleanField);
         ///fieldAndMixinNames.push(fieldName);
      }
   }
   function fieldToCleanField(field) {
      // copy field to clean it up from import conf :
      var cleanField = {};
      for (var key in field) {
         if (key.lastIndexOf("importconf:", 0) === 0) { // startsWith
            continue; // skip import-only fields that are not defined in server
         }
         cleanField[key] = field[key];
      }
      if (cleanField['dcmf:type'] === 'map') {
         cleanField['dcmf:mapFields'] = [];
         fieldsToArray(field['dcmf:mapFields'], cleanField['dcmf:mapFields']);
      } else if (cleanField['dcmf:type'] === 'list' || cleanField['dcmf:type'] === 'i18n') {
         cleanField['dcmf:listElementField'] = fieldToCleanField(field['dcmf:listElementField']);
      }
      return cleanField;
   }
   
   function refreshAndSchedulePost(modelOrMixinArray, relativeTypeUrl, postedCallback, importState) {
      for (var mInd in modelOrMixinArray) {
         if (importState.aborted) {
            return abortImport();
         }
         var mixin = modelOrMixinArray[mInd];
         // posting one at a time rather than all at once because version has
         // to be refreshed and it is easier to do it in sync this way
         var uri = mixin["@id"];
         var relativeUrl = uri.substring(uri.indexOf("/dc/type/"));
         getData(relativeUrl, function (resource) {
            // updating existing resource : 
            // NB. can't access "mixin" variable because has been changed since call is async
            var upToDateMixin = findMixin(resource["dcmo:name"], modelOrMixinArray);
            upToDateMixin["o:version"] = resource["o:version"];
            postAllDataInType(relativeTypeUrl, upToDateMixin,
                  postedCallback, postedCallback);
         }, function (data) {
            // creating new resource :
            var relativeUrl = data.request.path
            var resourceIri = relativeUrl.substring(relativeUrl.indexOf("/dc/type/") + "/dc/type/".length);
            var typeName = decodeURIComponent(resourceIri.substring(resourceIri.indexOf("/") + 1)); // else "elec%3ADepartment_0" ; AND NOT decodeURI
            var upToDateMixin = findMixin(typeName, modelOrMixinArray);
            postAllDataInType(relativeTypeUrl, upToDateMixin,
                  postedCallback, postedCallback);
         });
      }
   }

   function getModelRowLimit() {
      var modelRowLimit = parseInt($(".modelRowLimit").val(), 10);
      if (typeof modelRowLimit === 'number') { // && resourceRowLimit < 500
         return modelRowLimit;
      }
      return -1;
   }
   function resetModelCounters() {
      $('.modelRowCounter').html("Handled no model row yet");
      $('.modelCounter').html("Posted no model yet");
   }
   /*function abortImport(msg) {
      if (msg) {
         msg = " Aborted. " + msg;
      } else {
         msg = " Aborted."
      }
      $('.resourceRowCounter').html($('.resourceRowCounter').html() + msg);
      $('.importedResourcesFromCsv').html(msg);
      throw msg;
   }*/
   function abortImport(msg) {
      if (!window.importState) {
         return; // already called
      }
      
      if (Object.keys(importState.data.posted.postedResources).length !== 0) {
         displayImportedResourcesPosted(importState.data.posted);
      } else if (importState.data.rowNb !== 0) {
         displayParsedResource(importState);
      } else if (Object.keys(importState.model.posted.postedResources).length !== 0) {
         displayImportedResourcesPosted(importState.model.posted);
      } else if (importState.model.modelArray !== null) {
         displayImportedModels(importState);
      }
      
      if (msg) {
         msg = "Aborted. " + msg + " ";
      } else {
         msg = "Aborted. "
      }
      $('.resourceRowCounter').html(msg + $('.resourceRowCounter').html());
      $('.importedResourcesFromCsv').html(msg);
      
      concludeImport();
      return true;
   }
   function concludeImport() {
      delete window.importState;
      $('.dc-import-button').html('<b>import</b>');
   }
   function importModelAndResources() {
      if (window.importState) {
         window.importState.aborted = true;
         $('.dc-import-button').html('aborted');
         //abortImport(); // not only in loops, also there so that it's sure to happen
         return;
      } else {
         $('.dc-import-button').html('abort');
      }
      
      resetModelCounters();
      resetResourceCounters();
      
      var importState = {
            aborted : false,
            // CUSTOM
            typeMap : { // TODO more
                  "string" : "string",
                  "integer" : "int", // alias
                  "int" : "int",
                  "long" : "long",
                  "float" : "float",
                  "double" : "double",
                  "boolean" : "boolean",
                  "date" : "date",
                  "list" : "list",
                  "map" : "map",
                  "resource" : "resource",
                  "i18n" : "i18n"
            },
            domainPrefix : 'elec', // first three letters of model import file, changed on file select by UI calling buildModelDomainPrefix()
            projectAbsoluteName : 'oasis.main', // TODO allow to choose
            mixinMajorVersion : 0, // TODO better
            metamodel : {},
            model : {
               fileName : '', // set below
               defaultRow : {},
               modelOrMixins : {}, // NOOOO MUST NOT BE USED outside of csvToModel because have no global fields, rather use .data.involvedMixins
               mixinNameToFieldNameTree : {},
               fieldNamesWithInternalNameMap : {}, // used as set to get all models or mixins that are imported
               ///modelOrMixinArray : null, // MUST NOT BE USED outside of csvToModel because have no global fields, rather use .data.involvedMixins
               ///mixinArray : null, // MUST NOT BE USED outside of csvToModel because have no global fields, rather use .data.involvedMixins
               modelArray : null, // MUST NOT BE USED outside of csvToModel because have no global fields, rather use .data.involvedMixins
               loops : 0,
               warnings : [],
               errors : [],
               posted : {
                  toBePostedNb : 0, // = modelArray length
                  postedNb : 0,
                  postedResources : {}, // set
                  warnings : [],
                  errors : [],
                  errorHtml : "" 
               }
            },
            data : {
               fileName : '', // set below
               dataColumnNames : null,
               involvedMixins : [],
               rowNb : 0,
               row : { // current row
                  loopIndex : 0,
                  resourceRow : null,
                  modelTypeToRowResources : {},
                  missingIdFieldResourceOrMixins : null
               },
               resources : {},
               warnings : [],
               errors : [],
               posted : {
                  toBePostedNb : 0, // = resources nb
                  postedNb : 0,
                  postedResources : {}, // set
                  warnings : [],
                  errors : [],
                  errorHtml : ""
               }
            }
      }
      window.importState = importState; // making available globally for abort
      
      findDataByType("/dc/type/dcmo:model_0?dcmo:name=$regexdcm.*", function (resources) {
         for (var mmInd in resources) {
            var modelResource = resources[mmInd];
            importState["metamodel"][modelResource["dcmo:name"]] = modelResource;
         }
         
         
      var modelParsingConf = {
         download: true,
         header: true,
         comments: true, // skip # or // starting lines
         preview: getModelRowLimit() + 1, // ex. '1' user input means importing title line + 1 more line
         complete: function(results) {
            var prettyJson = JSON.stringify(results.data, null, '\t').replace(/\n/g, '<br>');
            $('.importedJsonFromCsv').html(prettyJson);
            
            csvToModel(results.data, importState, function (importState) {
               var mixins = importState.model.modelOrMixins;
               var message = "Handled " + Object.keys(mixins).length + " models or mixins in "
                     + importState.model.loops + " loops";
               if (importState.model.errors.length != 0) {
                  message += ". Aborting, please patch errors:<br/>"
                        + JSON.stringify(importState.model.errors, null, '\t');
               }
               $('.modelRowCounter').html(message);
               if (importState.model.errors.length != 0) {
                  return; // aborting
               }
               
               function fillDataWhenAllModelsUpdated(resourcesOrData, origResources) {
                  importedResourcePosted(resourcesOrData, importState.model.posted, importState,
                        "models or mixin", $('.modelCounter'), origResources, fillData);
               };

               importState.model.posted.toBePostedNb = importState.model.modelArray.length;
               refreshAndSchedulePost(importState.model.modelArray, '/dc/type/dcmo:model_0',
                     fillDataWhenAllModelsUpdated, importState);
            });
         }
      };


      importState.domainPrefix = $(".domainPrefix").val(); // changed by UI on model file select to its first three letters, else elec
      importState.model.fileName = $(".modelFile").val();
      if (importState.model.fileName !== "") {
         $(".modelFile").parse({ config : modelParsingConf });
      } else {
         importState.model.fileName = "samples/openelec/oasis-donnees-metiers-openelec.csv";
         Papa.parse(importState.model.fileName + "?reload="
               + new Date().getTime(), modelParsingConf); // to prevent browser caching
      }

      });
      return false;
   }
