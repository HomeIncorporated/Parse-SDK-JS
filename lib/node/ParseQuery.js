'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _CoreManager = require('./CoreManager');

var _CoreManager2 = _interopRequireDefault(_CoreManager);

var _encode = require('./encode');

var _encode2 = _interopRequireDefault(_encode);

var _ParseError = require('./ParseError');

var _ParseError2 = _interopRequireDefault(_ParseError);

var _ParseGeoPoint = require('./ParseGeoPoint');

var _ParseGeoPoint2 = _interopRequireDefault(_ParseGeoPoint);

var _ParsePolygon = require('./ParsePolygon');

var _ParsePolygon2 = _interopRequireDefault(_ParsePolygon);

var _ParseObject = require('./ParseObject');

var _ParseObject2 = _interopRequireDefault(_ParseObject);

var _ParsePromise = require('./ParsePromise');

var _ParsePromise2 = _interopRequireDefault(_ParsePromise);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

/**
 * Converts a string into a regex that matches it.
 * Surrounding with \Q .. \E does this, we just need to escape any \E's in
 * the text separately.
 * @private
 */
function quote(s) {
  return '\\Q' + s.replace('\\E', '\\E\\\\E\\Q') + '\\E';
}

/**
 * Extracts the class name from queries. If not all queries have the same
 * class name an error will be thrown.
 */
/*
 * Copyright (c) 2015-present, Parse, LLC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */

function _getClassNameFromQueries(queries) {
  var className = null;
  queries.forEach(function (q) {
    if (!className) {
      className = q.className;
    }

    if (className !== q.className) {
      throw new Error('All queries must be for the same class.');
    }
  });
  return className;
}

/*
 * Handles pre-populating the result data of a query with select fields,
 * making sure that the data object contains keys for all objects that have
 * been requested with a select, so that our cached state updates correctly.
 */
function handleSelectResult(data, select) {
  var serverDataMask = {};

  select.forEach(function (field) {
    var hasSubObjectSelect = field.indexOf(".") !== -1;
    if (!hasSubObjectSelect && !data.hasOwnProperty(field)) {
      // this field was selected, but is missing from the retrieved data
      data[field] = undefined;
    } else if (hasSubObjectSelect) {
      // this field references a sub-object,
      // so we need to walk down the path components
      var pathComponents = field.split(".");
      var obj = data;
      var serverMask = serverDataMask;

      pathComponents.forEach(function (component, index, arr) {
        // add keys if the expected data is missing
        if (obj && !obj.hasOwnProperty(component)) {
          obj[component] = undefined;
        }
        if (obj !== undefined) {
          obj = obj[component];
        }

        //add this path component to the server mask so we can fill it in later if needed
        if (index < arr.length - 1) {
          if (!serverMask[component]) {
            serverMask[component] = {};
          }
          serverMask = serverMask[component];
        }
      });
    }
  });

  if ((0, _keys2.default)(serverDataMask).length > 0) {
    var copyMissingDataWithMask = function copyMissingDataWithMask(src, dest, mask, copyThisLevel) {
      //copy missing elements at this level
      if (copyThisLevel) {
        for (var key in src) {
          if (src.hasOwnProperty(key) && !dest.hasOwnProperty(key)) {
            dest[key] = src[key];
          }
        }
      }
      for (var key in mask) {
        if (dest[key] !== undefined && dest[key] !== null && src !== undefined && src !== null) {
          //traverse into objects as needed
          copyMissingDataWithMask(src[key], dest[key], mask[key], true);
        }
      }
    };

    // When selecting from sub-objects, we don't want to blow away the missing
    // information that we may have retrieved before. We've already added any
    // missing selected keys to sub-objects, but we still need to add in the
    // data for any previously retrieved sub-objects that were not selected.

    var serverData = _CoreManager2.default.getObjectStateController().getServerData({ id: data.objectId, className: data.className });

    copyMissingDataWithMask(serverData, data, serverDataMask, false);
  }
}

/**
 * Creates a new parse Parse.Query for the given Parse.Object subclass.
 *
 * <p>Parse.Query defines a query that is used to fetch Parse.Objects. The
 * most common use case is finding all objects that match a query through the
 * <code>find</code> method. for example, this sample code fetches all objects
 * of class <code>myclass</code>. it calls a different function depending on
 * whether the fetch succeeded or not.
 *
 * <pre>
 * var query = new parse.query(myclass);
 * query.find({
 *   success: function(results) {
 *     // results is an array of parse.object.
 *   },
 *
 *   error: function(error) {
 *     // error is an instance of parse.error.
 *   }
 * });</pre></p>
 *
 * <p>a parse.query can also be used to retrieve a single object whose id is
 * known, through the get method. for example, this sample code fetches an
 * object of class <code>myclass</code> and id <code>myid</code>. it calls a
 * different function depending on whether the fetch succeeded or not.
 *
 * <pre>
 * var query = new parse.query(myclass);
 * query.get(myid, {
 *   success: function(object) {
 *     // object is an instance of parse.object.
 *   },
 *
 *   error: function(object, error) {
 *     // error is an instance of parse.error.
 *   }
 * });</pre></p>
 *
 * <p>a parse.query can also be used to count the number of objects that match
 * the query without retrieving all of those objects. for example, this
 * sample code counts the number of objects of the class <code>myclass</code>
 * <pre>
 * var query = new parse.query(myclass);
 * query.count({
 *   success: function(number) {
 *     // there are number instances of myclass.
 *   },
 *
 *   error: function(error) {
 *     // error is an instance of Parse.Error.
 *   }
 * });</pre></p>
 * @alias Parse.Query
 */

var ParseQuery = function () {

  /**
   * @param {(String|Parse.Object)} objectClass An instance of a subclass of Parse.Object, or a Parse className string.
   */

  /**
   * @property className
   * @type String
   */
  function ParseQuery(objectClass) {
    (0, _classCallCheck3.default)(this, ParseQuery);

    if (typeof objectClass === 'string') {
      if (objectClass === 'User' && _CoreManager2.default.get('PERFORM_USER_REWRITE')) {
        this.className = '_User';
      } else {
        this.className = objectClass;
      }
    } else if (objectClass instanceof _ParseObject2.default) {
      this.className = objectClass.className;
    } else if (typeof objectClass === 'function') {
      if (typeof objectClass.className === 'string') {
        this.className = objectClass.className;
      } else {
        var obj = new objectClass();
        this.className = obj.className;
      }
    } else {
      throw new TypeError('A ParseQuery must be constructed with a ParseObject or class name.');
    }

    this._where = {};
    this._include = [];
    this._limit = -1; // negative limit is not sent in the server request
    this._skip = 0;
    this._extraOptions = {};
  }

  /**
   * Adds constraint that at least one of the passed in queries matches.
   * @param {Array} queries
   * @return {Parse.Query} Returns the query, so you can chain this call.
   */

  (0, _createClass3.default)(ParseQuery, [{
    key: '_orQuery',
    value: function (queries) {
      var queryJSON = queries.map(function (q) {
        return q.toJSON().where;
      });

      this._where.$or = queryJSON;
      return this;
    }

    /**
     * Adds constraint that all of the passed in queries match.
     * @method _andQuery
     * @param {Array} queries
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: '_andQuery',
    value: function (queries) {
      var queryJSON = queries.map(function (q) {
        return q.toJSON().where;
      });

      this._where.$and = queryJSON;
      return this;
    }

    /**
     * Helper for condition queries
     */

  }, {
    key: '_addCondition',
    value: function (key, condition, value) {
      if (!this._where[key] || typeof this._where[key] === 'string') {
        this._where[key] = {};
      }
      this._where[key][condition] = (0, _encode2.default)(value, false, true);
      return this;
    }

    /**
     * Returns a JSON representation of this query.
     * @return {Object} The JSON representation of the query.
     */

  }, {
    key: 'toJSON',
    value: function () {
      var params = {
        where: this._where
      };

      if (this._include.length) {
        params.include = this._include.join(',');
      }
      if (this._select) {
        params.keys = this._select.join(',');
      }
      if (this._limit >= 0) {
        params.limit = this._limit;
      }
      if (this._skip > 0) {
        params.skip = this._skip;
      }
      if (this._order) {
        params.order = this._order.join(',');
      }
      for (var key in this._extraOptions) {
        params[key] = this._extraOptions[key];
      }

      return params;
    }

    /**
     * Return a query with conditions from json, can be useful to send query from server side to client
     * Not static, all query conditions was set before calling this method will be deleted.
     * For example on the server side we have
     * var query = new Parse.Query("className");
     * query.equalTo(key: value);
     * query.limit(100);
     * ... (others queries)
     * Create JSON representation of Query Object
     * var jsonFromServer = query.fromJSON();
     *
     * On client side getting query:
     * var query = new Parse.Query("className");
     * query.fromJSON(jsonFromServer);
     *
     * and continue to query...
     * query.skip(100).find().then(...);
     * @param {QueryJSON} json from Parse.Query.toJSON() method
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'withJSON',
    value: function (json) {

      if (json.where) {
        this._where = json.where;
      }

      if (json.include) {
        this._include = json.include.split(",");
      }

      if (json.keys) {
        this._select = json.keys.split(",");
      }

      if (json.limit) {
        this._limit = json.limit;
      }

      if (json.skip) {
        this._skip = json.skip;
      }

      if (json.order) {
        this._order = json.order.split(",");
      }

      for (var _key in json) {
        if (json.hasOwnProperty(_key)) {
          if (["where", "include", "keys", "limit", "skip", "order"].indexOf(_key) === -1) {
            this._extraOptions[_key] = json[_key];
          }
        }
      }return this;
    }

    /**
     * Static method to restore Parse.Query by json representation
     * Internally calling Parse.Query.withJSON
     * @param {String} className
     * @param {QueryJSON} json from Parse.Query.toJSON() method
     * @returns {Parse.Query} new created query
     */

  }, {
    key: 'get',

    /**
     * Constructs a Parse.Object whose id is already known by fetching data from
     * the server.  Either options.success or options.error is called when the
     * find completes.
     *
     * @param {String} objectId The id of the object to be fetched.
     * @param {Object} options A Backbone-style options object.
     * Valid options are:<ul>
     *   <li>success: A Backbone-style success callback
     *   <li>error: An Backbone-style error callback.
     *   <li>useMasterKey: In Cloud Code and Node only, causes the Master Key to
     *     be used for this request.
     *   <li>sessionToken: A valid session token, used for making a request on
     *       behalf of a specific user.
     * </ul>
     *
     * @return {Parse.Promise} A promise that is resolved with the result when
     * the query completes.
     */
    value: function (objectId, options) {
      this.equalTo('objectId', objectId);

      var firstOptions = {};
      if (options && options.hasOwnProperty('useMasterKey')) {
        firstOptions.useMasterKey = options.useMasterKey;
      }
      if (options && options.hasOwnProperty('sessionToken')) {
        firstOptions.sessionToken = options.sessionToken;
      }

      return this.first(firstOptions).then(function (response) {
        if (response) {
          return response;
        }

        var errorObject = new _ParseError2.default(_ParseError2.default.OBJECT_NOT_FOUND, 'Object not found.');
        return _ParsePromise2.default.error(errorObject);
      })._thenRunCallbacks(options, null);
    }

    /**
     * Retrieves a list of ParseObjects that satisfy this query.
     * Either options.success or options.error is called when the find
     * completes.
     *
     * @param {Object} options A Backbone-style options object. Valid options
     * are:<ul>
     *   <li>success: Function to call when the find completes successfully.
     *   <li>error: Function to call when the find fails.
     *   <li>useMasterKey: In Cloud Code and Node only, causes the Master Key to
     *     be used for this request.
     *   <li>sessionToken: A valid session token, used for making a request on
     *       behalf of a specific user.
     * </ul>
     *
     * @return {Parse.Promise} A promise that is resolved with the results when
     * the query completes.
     */

  }, {
    key: 'find',
    value: function (options) {
      var _this = this;

      options = options || {};

      var findOptions = {};
      if (options.hasOwnProperty('useMasterKey')) {
        findOptions.useMasterKey = options.useMasterKey;
      }
      if (options.hasOwnProperty('sessionToken')) {
        findOptions.sessionToken = options.sessionToken;
      }

      var controller = _CoreManager2.default.getQueryController();

      var select = this._select;

      return controller.find(this.className, this.toJSON(), findOptions).then(function (response) {
        return response.results.map(function (data) {
          // In cases of relations, the server may send back a className
          // on the top level of the payload
          var override = response.className || _this.className;
          if (!data.className) {
            data.className = override;
          }

          // Make sure the data object contains keys for all objects that
          // have been requested with a select, so that our cached state
          // updates correctly.
          if (select) {
            handleSelectResult(data, select);
          }

          return _ParseObject2.default.fromJSON(data, !select);
        });
      })._thenRunCallbacks(options);
    }

    /**
     * Counts the number of objects that match this query.
     * Either options.success or options.error is called when the count
     * completes.
     *
     * @param {Object} options A Backbone-style options object. Valid options
     * are:<ul>
     *   <li>success: Function to call when the count completes successfully.
     *   <li>error: Function to call when the find fails.
     *   <li>useMasterKey: In Cloud Code and Node only, causes the Master Key to
     *     be used for this request.
     *   <li>sessionToken: A valid session token, used for making a request on
     *       behalf of a specific user.
     * </ul>
     *
     * @return {Parse.Promise} A promise that is resolved with the count when
     * the query completes.
     */

  }, {
    key: 'count',
    value: function (options) {
      options = options || {};

      var findOptions = {};
      if (options.hasOwnProperty('useMasterKey')) {
        findOptions.useMasterKey = options.useMasterKey;
      }
      if (options.hasOwnProperty('sessionToken')) {
        findOptions.sessionToken = options.sessionToken;
      }

      var controller = _CoreManager2.default.getQueryController();

      var params = this.toJSON();
      params.limit = 0;
      params.count = 1;

      return controller.find(this.className, params, findOptions).then(function (result) {
        return result.count;
      })._thenRunCallbacks(options);
    }

    /**
     * Executes a distinct query and returns unique values
     *
     * @param {String} key A field to find distinct values
     * @param {Object} options A Backbone-style options object. Valid options
     * are:<ul>
     *   <li>success: Function to call when the count completes successfully.
     *   <li>error: Function to call when the find fails.
     *   <li>sessionToken: A valid session token, used for making a request on
     *       behalf of a specific user.
     * </ul>
     *
     * @return {Parse.Promise} A promise that is resolved with the query completes.
     */

  }, {
    key: 'distinct',
    value: function (key, options) {
      options = options || {};

      var distinctOptions = {
        useMasterKey: true
      };
      if (options.hasOwnProperty('sessionToken')) {
        distinctOptions.sessionToken = options.sessionToken;
      }
      var controller = _CoreManager2.default.getQueryController();
      var params = {
        distinct: key,
        where: this._where
      };

      return controller.aggregate(this.className, params, distinctOptions).then(function (results) {
        return results.results;
      })._thenRunCallbacks(options);
    }

    /**
    * Executes an aggregate query and returns aggregate results
    *
    * @param {Mixed} pipeline Array or Object of stages to process query
    * @param {Object} options A Backbone-style options object. Valid options
    * are:<ul>
    *   <li>success: Function to call when the count completes successfully.
    *   <li>error: Function to call when the find fails.
    *   <li>sessionToken: A valid session token, used for making a request on
    *       behalf of a specific user.
    * </ul>
    *
    * @return {Parse.Promise} A promise that is resolved with the query completes.
    */

  }, {
    key: 'aggregate',
    value: function (pipeline, options) {
      options = options || {};

      var aggregateOptions = {
        useMasterKey: true
      };
      if (options.hasOwnProperty('sessionToken')) {
        aggregateOptions.sessionToken = options.sessionToken;
      }
      var controller = _CoreManager2.default.getQueryController();
      var stages = {};

      if (Array.isArray(pipeline)) {
        pipeline.forEach(function (stage) {
          for (var op in stage) {
            stages[op] = stage[op];
          }
        });
      } else if (pipeline && (typeof pipeline === 'undefined' ? 'undefined' : (0, _typeof3.default)(pipeline)) === 'object') {
        stages = pipeline;
      } else {
        throw new Error('Invalid pipeline must be Array or Object');
      }

      return controller.aggregate(this.className, stages, aggregateOptions).then(function (results) {
        return results.results;
      })._thenRunCallbacks(options);
    }

    /**
     * Retrieves at most one Parse.Object that satisfies this query.
     *
     * Either options.success or options.error is called when it completes.
     * success is passed the object if there is one. otherwise, undefined.
     *
     * @param {Object} options A Backbone-style options object. Valid options
     * are:<ul>
     *   <li>success: Function to call when the find completes successfully.
     *   <li>error: Function to call when the find fails.
     *   <li>useMasterKey: In Cloud Code and Node only, causes the Master Key to
     *     be used for this request.
     *   <li>sessionToken: A valid session token, used for making a request on
     *       behalf of a specific user.
     * </ul>
     *
     * @return {Parse.Promise} A promise that is resolved with the object when
     * the query completes.
     */

  }, {
    key: 'first',
    value: function (options) {
      var _this2 = this;

      options = options || {};

      var findOptions = {};
      if (options.hasOwnProperty('useMasterKey')) {
        findOptions.useMasterKey = options.useMasterKey;
      }
      if (options.hasOwnProperty('sessionToken')) {
        findOptions.sessionToken = options.sessionToken;
      }

      var controller = _CoreManager2.default.getQueryController();

      var params = this.toJSON();
      params.limit = 1;

      var select = this._select;

      return controller.find(this.className, params, findOptions).then(function (response) {
        var objects = response.results;
        if (!objects[0]) {
          return undefined;
        }
        if (!objects[0].className) {
          objects[0].className = _this2.className;
        }

        // Make sure the data object contains keys for all objects that
        // have been requested with a select, so that our cached state
        // updates correctly.
        if (select) {
          handleSelectResult(objects[0], select);
        }

        return _ParseObject2.default.fromJSON(objects[0], !select);
      })._thenRunCallbacks(options);
    }

    /**
     * Iterates over each result of a query, calling a callback for each one. If
     * the callback returns a promise, the iteration will not continue until
     * that promise has been fulfilled. If the callback returns a rejected
     * promise, then iteration will stop with that error. The items are
     * processed in an unspecified order. The query may not have any sort order,
     * and may not use limit or skip.
     * @param {Function} callback Callback that will be called with each result
     *     of the query.
     * @param {Object} options A Backbone-style options object. Valid options
     * are:<ul>
     *   <li>success: Function to call when the iteration completes successfully.
     *   <li>error: Function to call when the iteration fails.
     *   <li>useMasterKey: In Cloud Code and Node only, causes the Master Key to
     *     be used for this request.
     *   <li>sessionToken: A valid session token, used for making a request on
     *       behalf of a specific user.
     * </ul>
     * @return {Parse.Promise} A promise that will be fulfilled once the
     *     iteration has completed.
     */

  }, {
    key: 'each',
    value: function (callback, options) {
      options = options || {};

      if (this._order || this._skip || this._limit >= 0) {
        return _ParsePromise2.default.error('Cannot iterate on a query with sort, skip, or limit.')._thenRunCallbacks(options);
      }

      new _ParsePromise2.default();


      var query = new ParseQuery(this.className);
      // We can override the batch size from the options.
      // This is undocumented, but useful for testing.
      query._limit = options.batchSize || 100;
      query._include = this._include.map(function (i) {
        return i;
      });
      if (this._select) {
        query._select = this._select.map(function (s) {
          return s;
        });
      }

      query._where = {};
      for (var attr in this._where) {
        var val = this._where[attr];
        if (Array.isArray(val)) {
          query._where[attr] = val.map(function (v) {
            return v;
          });
        } else if (val && (typeof val === 'undefined' ? 'undefined' : (0, _typeof3.default)(val)) === 'object') {
          var conditionMap = {};
          query._where[attr] = conditionMap;
          for (var cond in val) {
            conditionMap[cond] = val[cond];
          }
        } else {
          query._where[attr] = val;
        }
      }

      query.ascending('objectId');

      var findOptions = {};
      if (options.hasOwnProperty('useMasterKey')) {
        findOptions.useMasterKey = options.useMasterKey;
      }
      if (options.hasOwnProperty('sessionToken')) {
        findOptions.sessionToken = options.sessionToken;
      }

      var finished = false;
      return _ParsePromise2.default._continueWhile(function () {
        return !finished;
      }, function () {
        return query.find(findOptions).then(function (results) {
          var callbacksDone = _ParsePromise2.default.as();
          results.forEach(function (result) {
            callbacksDone = callbacksDone.then(function () {
              return callback(result);
            });
          });

          return callbacksDone.then(function () {
            if (results.length >= query._limit) {
              query.greaterThan('objectId', results[results.length - 1].id);
            } else {
              finished = true;
            }
          });
        });
      })._thenRunCallbacks(options);
    }

    /** Query Conditions **/

    /**
     * Adds a constraint to the query that requires a particular key's value to
     * be equal to the provided value.
     * @param {String} key The key to check.
     * @param value The value that the Parse.Object must contain.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'equalTo',
    value: function (key, value) {
      if (typeof value === 'undefined') {
        return this.doesNotExist(key);
      }

      this._where[key] = (0, _encode2.default)(value, false, true);
      return this;
    }

    /**
     * Adds a constraint to the query that requires a particular key's value to
     * be not equal to the provided value.
     * @param {String} key The key to check.
     * @param value The value that must not be equalled.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'notEqualTo',
    value: function (key, value) {
      return this._addCondition(key, '$ne', value);
    }

    /**
     * Adds a constraint to the query that requires a particular key's value to
     * be less than the provided value.
     * @param {String} key The key to check.
     * @param value The value that provides an upper bound.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'lessThan',
    value: function (key, value) {
      return this._addCondition(key, '$lt', value);
    }

    /**
     * Adds a constraint to the query that requires a particular key's value to
     * be greater than the provided value.
     * @param {String} key The key to check.
     * @param value The value that provides an lower bound.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'greaterThan',
    value: function (key, value) {
      return this._addCondition(key, '$gt', value);
    }

    /**
     * Adds a constraint to the query that requires a particular key's value to
     * be less than or equal to the provided value.
     * @param {String} key The key to check.
     * @param value The value that provides an upper bound.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'lessThanOrEqualTo',
    value: function (key, value) {
      return this._addCondition(key, '$lte', value);
    }

    /**
     * Adds a constraint to the query that requires a particular key's value to
     * be greater than or equal to the provided value.
     * @param {String} key The key to check.
     * @param value The value that provides an lower bound.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'greaterThanOrEqualTo',
    value: function (key, value) {
      return this._addCondition(key, '$gte', value);
    }

    /**
     * Adds a constraint to the query that requires a particular key's value to
     * be contained in the provided list of values.
     * @param {String} key The key to check.
     * @param {Array} values The values that will match.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'containedIn',
    value: function (key, value) {
      return this._addCondition(key, '$in', value);
    }

    /**
     * Adds a constraint to the query that requires a particular key's value to
     * not be contained in the provided list of values.
     * @param {String} key The key to check.
     * @param {Array} values The values that will not match.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'notContainedIn',
    value: function (key, value) {
      return this._addCondition(key, '$nin', value);
    }

    /**
     * Adds a constraint to the query that requires a particular key's value to
     * contain each one of the provided list of values.
     * @param {String} key The key to check.  This key's value must be an array.
     * @param {Array} values The values that will match.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'containsAll',
    value: function (key, values) {
      return this._addCondition(key, '$all', values);
    }

    /**
     * Adds a constraint for finding objects that contain the given key.
     * @param {String} key The key that should exist.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'exists',
    value: function (key) {
      return this._addCondition(key, '$exists', true);
    }

    /**
     * Adds a constraint for finding objects that do not contain a given key.
     * @param {String} key The key that should not exist
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'doesNotExist',
    value: function (key) {
      return this._addCondition(key, '$exists', false);
    }

    /**
     * Adds a regular expression constraint for finding string values that match
     * the provided regular expression.
     * This may be slow for large datasets.
     * @param {String} key The key that the string to match is stored in.
     * @param {RegExp} regex The regular expression pattern to match.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'matches',
    value: function (key, regex, modifiers) {
      this._addCondition(key, '$regex', regex);
      if (!modifiers) {
        modifiers = '';
      }
      if (regex.ignoreCase) {
        modifiers += 'i';
      }
      if (regex.multiline) {
        modifiers += 'm';
      }
      if (modifiers.length) {
        this._addCondition(key, '$options', modifiers);
      }
      return this;
    }

    /**
     * Adds a constraint that requires that a key's value matches a Parse.Query
     * constraint.
     * @param {String} key The key that the contains the object to match the
     *                     query.
     * @param {Parse.Query} query The query that should match.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'matchesQuery',
    value: function (key, query) {
      var queryJSON = query.toJSON();
      queryJSON.className = query.className;
      return this._addCondition(key, '$inQuery', queryJSON);
    }

    /**
     * Adds a constraint that requires that a key's value not matches a
     * Parse.Query constraint.
     * @param {String} key The key that the contains the object to match the
     *                     query.
     * @param {Parse.Query} query The query that should not match.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'doesNotMatchQuery',
    value: function (key, query) {
      var queryJSON = query.toJSON();
      queryJSON.className = query.className;
      return this._addCondition(key, '$notInQuery', queryJSON);
    }

    /**
     * Adds a constraint that requires that a key's value matches a value in
     * an object returned by a different Parse.Query.
     * @param {String} key The key that contains the value that is being
     *                     matched.
     * @param {String} queryKey The key in the objects returned by the query to
     *                          match against.
     * @param {Parse.Query} query The query to run.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'matchesKeyInQuery',
    value: function (key, queryKey, query) {
      var queryJSON = query.toJSON();
      queryJSON.className = query.className;
      return this._addCondition(key, '$select', {
        key: queryKey,
        query: queryJSON
      });
    }

    /**
     * Adds a constraint that requires that a key's value not match a value in
     * an object returned by a different Parse.Query.
     * @param {String} key The key that contains the value that is being
     *                     excluded.
     * @param {String} queryKey The key in the objects returned by the query to
     *                          match against.
     * @param {Parse.Query} query The query to run.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'doesNotMatchKeyInQuery',
    value: function (key, queryKey, query) {
      var queryJSON = query.toJSON();
      queryJSON.className = query.className;
      return this._addCondition(key, '$dontSelect', {
        key: queryKey,
        query: queryJSON
      });
    }

    /**
     * Adds a constraint for finding string values that contain a provided
     * string.  This may be slow for large datasets.
     * @param {String} key The key that the string to match is stored in.
     * @param {String} substring The substring that the value must contain.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'contains',
    value: function (key, value) {
      if (typeof value !== 'string') {
        throw new Error('The value being searched for must be a string.');
      }
      return this._addCondition(key, '$regex', quote(value));
    }

    /**
    * Adds a constraint for finding string values that contain a provided
    * string. This may be slow for large datasets. Requires Parse-Server > 2.5.0
    *
    * In order to sort you must use select and ascending ($score is required)
    *  <pre>
    *   query.fullText('term');
    *   query.ascending('$score');
    *   query.select('$score');
    *  </pre>
    *
    * To retrieve the weight / rank
    *  <pre>
    *   object->get('score');
    *  </pre>
    *
    * @param {String} key The key that the string to match is stored in.
    * @param {String} value The string to search
    * @return {Parse.Query} Returns the query, so you can chain this call.
    */

  }, {
    key: 'fullText',
    value: function (key, value) {
      if (!key) {
        throw new Error('A key is required.');
      }
      if (!value) {
        throw new Error('A search term is required');
      }
      if (typeof value !== 'string') {
        throw new Error('The value being searched for must be a string.');
      }

      return this._addCondition(key, '$text', { $search: { $term: value } });
    }

    /**
     * Adds a constraint for finding string values that start with a provided
     * string.  This query will use the backend index, so it will be fast even
     * for large datasets.
     * @param {String} key The key that the string to match is stored in.
     * @param {String} prefix The substring that the value must start with.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'startsWith',
    value: function (key, value) {
      if (typeof value !== 'string') {
        throw new Error('The value being searched for must be a string.');
      }
      return this._addCondition(key, '$regex', '^' + quote(value));
    }

    /**
     * Adds a constraint for finding string values that end with a provided
     * string.  This will be slow for large datasets.
     * @param {String} key The key that the string to match is stored in.
     * @param {String} suffix The substring that the value must end with.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'endsWith',
    value: function (key, value) {
      if (typeof value !== 'string') {
        throw new Error('The value being searched for must be a string.');
      }
      return this._addCondition(key, '$regex', quote(value) + '$');
    }

    /**
     * Adds a proximity based constraint for finding objects with key point
     * values near the point given.
     * @param {String} key The key that the Parse.GeoPoint is stored in.
     * @param {Parse.GeoPoint} point The reference Parse.GeoPoint that is used.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'near',
    value: function (key, point) {
      if (!(point instanceof _ParseGeoPoint2.default)) {
        // Try to cast it as a GeoPoint
        point = new _ParseGeoPoint2.default(point);
      }
      return this._addCondition(key, '$nearSphere', point);
    }

    /**
     * Adds a proximity based constraint for finding objects with key point
     * values near the point given and within the maximum distance given.
     * @param {String} key The key that the Parse.GeoPoint is stored in.
     * @param {Parse.GeoPoint} point The reference Parse.GeoPoint that is used.
     * @param {Number} maxDistance Maximum distance (in radians) of results to
     *   return.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'withinRadians',
    value: function (key, point, distance) {
      this.near(key, point);
      return this._addCondition(key, '$maxDistance', distance);
    }

    /**
     * Adds a proximity based constraint for finding objects with key point
     * values near the point given and within the maximum distance given.
     * Radius of earth used is 3958.8 miles.
     * @param {String} key The key that the Parse.GeoPoint is stored in.
     * @param {Parse.GeoPoint} point The reference Parse.GeoPoint that is used.
     * @param {Number} maxDistance Maximum distance (in miles) of results to
     *     return.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'withinMiles',
    value: function (key, point, distance) {
      return this.withinRadians(key, point, distance / 3958.8);
    }

    /**
     * Adds a proximity based constraint for finding objects with key point
     * values near the point given and within the maximum distance given.
     * Radius of earth used is 6371.0 kilometers.
     * @param {String} key The key that the Parse.GeoPoint is stored in.
     * @param {Parse.GeoPoint} point The reference Parse.GeoPoint that is used.
     * @param {Number} maxDistance Maximum distance (in kilometers) of results
     *     to return.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'withinKilometers',
    value: function (key, point, distance) {
      return this.withinRadians(key, point, distance / 6371.0);
    }

    /**
     * Adds a constraint to the query that requires a particular key's
     * coordinates be contained within a given rectangular geographic bounding
     * box.
     * @param {String} key The key to be constrained.
     * @param {Parse.GeoPoint} southwest
     *     The lower-left inclusive corner of the box.
     * @param {Parse.GeoPoint} northeast
     *     The upper-right inclusive corner of the box.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'withinGeoBox',
    value: function (key, southwest, northeast) {
      if (!(southwest instanceof _ParseGeoPoint2.default)) {
        southwest = new _ParseGeoPoint2.default(southwest);
      }
      if (!(northeast instanceof _ParseGeoPoint2.default)) {
        northeast = new _ParseGeoPoint2.default(northeast);
      }
      this._addCondition(key, '$within', { '$box': [southwest, northeast] });
      return this;
    }

    /**
     * Adds a constraint to the query that requires a particular key's
     * coordinates be contained within and on the bounds of a given polygon.
     * Supports closed and open (last point is connected to first) paths
     *
     * Polygon must have at least 3 points
     *
     * @param {String} key The key to be constrained.
     * @param {Array} array of geopoints
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'withinPolygon',
    value: function (key, points) {
      return this._addCondition(key, '$geoWithin', { '$polygon': points });
    }

    /**
     * Add a constraint to the query that requires a particular key's
     * coordinates that contains a ParseGeoPoint
     *
     * @param {String} key The key to be constrained.
     * @param {Parse.GeoPoint} GeoPoint
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'polygonContains',
    value: function (key, point) {
      return this._addCondition(key, '$geoIntersects', { '$point': point });
    }

    /** Query Orderings **/

    /**
     * Sorts the results in ascending order by the given key.
     *
     * @param {(String|String[]|...String)} key The key to order by, which is a
     * string of comma separated values, or an Array of keys, or multiple keys.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'ascending',
    value: function () {
      this._order = [];

      for (var _len = arguments.length, keys = Array(_len), _key2 = 0; _key2 < _len; _key2++) {
        keys[_key2] = arguments[_key2];
      }

      return this.addAscending.apply(this, keys);
    }

    /**
     * Sorts the results in ascending order by the given key,
     * but can also add secondary sort descriptors without overwriting _order.
     *
     * @param {(String|String[]|...String)} key The key to order by, which is a
     * string of comma separated values, or an Array of keys, or multiple keys.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'addAscending',
    value: function () {
      var _this3 = this;

      if (!this._order) {
        this._order = [];
      }

      for (var _len2 = arguments.length, keys = Array(_len2), _key3 = 0; _key3 < _len2; _key3++) {
        keys[_key3] = arguments[_key3];
      }

      keys.forEach(function (key) {
        if (Array.isArray(key)) {
          key = key.join();
        }
        _this3._order = _this3._order.concat(key.replace(/\s/g, '').split(','));
      });

      return this;
    }

    /**
     * Sorts the results in descending order by the given key.
     *
     * @param {(String|String[]|...String)} key The key to order by, which is a
     * string of comma separated values, or an Array of keys, or multiple keys.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'descending',
    value: function () {
      this._order = [];

      for (var _len3 = arguments.length, keys = Array(_len3), _key4 = 0; _key4 < _len3; _key4++) {
        keys[_key4] = arguments[_key4];
      }

      return this.addDescending.apply(this, keys);
    }

    /**
     * Sorts the results in descending order by the given key,
     * but can also add secondary sort descriptors without overwriting _order.
     *
     * @param {(String|String[]|...String)} key The key to order by, which is a
     * string of comma separated values, or an Array of keys, or multiple keys.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'addDescending',
    value: function () {
      var _this4 = this;

      if (!this._order) {
        this._order = [];
      }

      for (var _len4 = arguments.length, keys = Array(_len4), _key5 = 0; _key5 < _len4; _key5++) {
        keys[_key5] = arguments[_key5];
      }

      keys.forEach(function (key) {
        if (Array.isArray(key)) {
          key = key.join();
        }
        _this4._order = _this4._order.concat(key.replace(/\s/g, '').split(',').map(function (k) {
          return '-' + k;
        }));
      });

      return this;
    }

    /** Query Options **/

    /**
     * Sets the number of results to skip before returning any results.
     * This is useful for pagination.
     * Default is to skip zero results.
     * @param {Number} n the number of results to skip.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'skip',
    value: function (n) {
      if (typeof n !== 'number' || n < 0) {
        throw new Error('You can only skip by a positive number');
      }
      this._skip = n;
      return this;
    }

    /**
     * Sets the limit of the number of results to return. The default limit is
     * 100, with a maximum of 1000 results being returned at a time.
     * @param {Number} n the number of results to limit to.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'limit',
    value: function (n) {
      if (typeof n !== 'number') {
        throw new Error('You can only set the limit to a numeric value');
      }
      this._limit = n;
      return this;
    }

    /**
     * Includes nested Parse.Objects for the provided key.  You can use dot
     * notation to specify which fields in the included object are also fetched.
     * @param {String} key The name of the key to include.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'include',
    value: function () {
      var _this5 = this;

      for (var _len5 = arguments.length, keys = Array(_len5), _key6 = 0; _key6 < _len5; _key6++) {
        keys[_key6] = arguments[_key6];
      }

      keys.forEach(function (key) {
        if (Array.isArray(key)) {
          _this5._include = _this5._include.concat(key);
        } else {
          _this5._include.push(key);
        }
      });
      return this;
    }

    /**
     * Restricts the fields of the returned Parse.Objects to include only the
     * provided keys.  If this is called multiple times, then all of the keys
     * specified in each of the calls will be included.
     * @param {Array} keys The names of the keys to include.
     * @return {Parse.Query} Returns the query, so you can chain this call.
     */

  }, {
    key: 'select',
    value: function () {
      var _this6 = this;

      if (!this._select) {
        this._select = [];
      }

      for (var _len6 = arguments.length, keys = Array(_len6), _key7 = 0; _key7 < _len6; _key7++) {
        keys[_key7] = arguments[_key7];
      }

      keys.forEach(function (key) {
        if (Array.isArray(key)) {
          _this6._select = _this6._select.concat(key);
        } else {
          _this6._select.push(key);
        }
      });
      return this;
    }

    /**
     * Subscribe this query to get liveQuery updates
     * @return {LiveQuerySubscription} Returns the liveQuerySubscription, it's an event emitter
     * which can be used to get liveQuery updates.
     */

  }, {
    key: 'subscribe',
    value: function () {
      var controller = _CoreManager2.default.getLiveQueryController();
      return controller.subscribe(this);
    }

    /**
     * Constructs a Parse.Query that is the OR of the passed in queries.  For
     * example:
     * <pre>var compoundQuery = Parse.Query.or(query1, query2, query3);</pre>
     *
     * will create a compoundQuery that is an or of the query1, query2, and
     * query3.
     * @param {...Parse.Query} var_args The list of queries to OR.
     * @static
     * @return {Parse.Query} The query that is the OR of the passed in queries.
     */

  }], [{
    key: 'fromJSON',
    value: function (className, json) {
      var query = new ParseQuery(className);
      return query.withJSON(json);
    }
  }, {
    key: 'or',
    value: function () {
      for (var _len7 = arguments.length, queries = Array(_len7), _key8 = 0; _key8 < _len7; _key8++) {
        queries[_key8] = arguments[_key8];
      }

      var className = _getClassNameFromQueries(queries);
      var query = new ParseQuery(className);
      query._orQuery(queries);
      return query;
    }

    /**
     * Constructs a Parse.Query that is the AND of the passed in queries.  For
     * example:
     * <pre>var compoundQuery = Parse.Query.and(query1, query2, query3);</pre>
     *
     * will create a compoundQuery that is an and of the query1, query2, and
     * query3.
     * @method and
     * @param {...Parse.Query} var_args The list of queries to AND.
     * @static
     * @return {Parse.Query} The query that is the AND of the passed in queries.
     */

  }, {
    key: 'and',
    value: function () {
      for (var _len8 = arguments.length, queries = Array(_len8), _key9 = 0; _key9 < _len8; _key9++) {
        queries[_key9] = arguments[_key9];
      }

      var className = _getClassNameFromQueries(queries);
      var query = new ParseQuery(className);
      query._andQuery(queries);
      return query;
    }
  }]);
  return ParseQuery;
}();

var DefaultController = {
  find: function (className, params, options) {
    var RESTController = _CoreManager2.default.getRESTController();

    return RESTController.request('GET', 'classes/' + className, params, options);
  },
  aggregate: function (className, params, options) {
    var RESTController = _CoreManager2.default.getRESTController();

    return RESTController.request('GET', 'aggregate/' + className, params, options);
  }
};

_CoreManager2.default.setQueryController(DefaultController);

exports.default = ParseQuery;