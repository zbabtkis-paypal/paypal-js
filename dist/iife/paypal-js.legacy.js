/*!
 * paypal-js v5.0.2 (2022-03-25T16:30:29.188Z)
 * Copyright 2020-present, PayPal, Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var paypalLoadScript = (function (exports) {
  'use strict';

  /**
   * @this {Promise}
   */
  function finallyConstructor(callback) {
    var constructor = this.constructor;
    return this.then(
      function(value) {
        // @ts-ignore
        return constructor.resolve(callback()).then(function() {
          return value;
        });
      },
      function(reason) {
        // @ts-ignore
        return constructor.resolve(callback()).then(function() {
          // @ts-ignore
          return constructor.reject(reason);
        });
      }
    );
  }

  function allSettled(arr) {
    var P = this;
    return new P(function(resolve, reject) {
      if (!(arr && typeof arr.length !== 'undefined')) {
        return reject(
          new TypeError(
            typeof arr +
              ' ' +
              arr +
              ' is not iterable(cannot read property Symbol(Symbol.iterator))'
          )
        );
      }
      var args = Array.prototype.slice.call(arr);
      if (args.length === 0) return resolve([]);
      var remaining = args.length;

      function res(i, val) {
        if (val && (typeof val === 'object' || typeof val === 'function')) {
          var then = val.then;
          if (typeof then === 'function') {
            then.call(
              val,
              function(val) {
                res(i, val);
              },
              function(e) {
                args[i] = { status: 'rejected', reason: e };
                if (--remaining === 0) {
                  resolve(args);
                }
              }
            );
            return;
          }
        }
        args[i] = { status: 'fulfilled', value: val };
        if (--remaining === 0) {
          resolve(args);
        }
      }

      for (var i = 0; i < args.length; i++) {
        res(i, args[i]);
      }
    });
  }

  // Store setTimeout reference so promise-polyfill will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var setTimeoutFunc = setTimeout;
  // @ts-ignore
  var setImmediateFunc = typeof setImmediate !== 'undefined' ? setImmediate : null;

  function isArray(x) {
    return Boolean(x && typeof x.length !== 'undefined');
  }

  function noop() {}

  // Polyfill for Function.prototype.bind
  function bind(fn, thisArg) {
    return function() {
      fn.apply(thisArg, arguments);
    };
  }

  /**
   * @constructor
   * @param {Function} fn
   */
  function Promise$1(fn) {
    if (!(this instanceof Promise$1))
      throw new TypeError('Promises must be constructed via new');
    if (typeof fn !== 'function') throw new TypeError('not a function');
    /** @type {!number} */
    this._state = 0;
    /** @type {!boolean} */
    this._handled = false;
    /** @type {Promise|undefined} */
    this._value = undefined;
    /** @type {!Array<!Function>} */
    this._deferreds = [];

    doResolve(fn, this);
  }

  function handle(self, deferred) {
    while (self._state === 3) {
      self = self._value;
    }
    if (self._state === 0) {
      self._deferreds.push(deferred);
      return;
    }
    self._handled = true;
    Promise$1._immediateFn(function() {
      var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
      if (cb === null) {
        (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
        return;
      }
      var ret;
      try {
        ret = cb(self._value);
      } catch (e) {
        reject(deferred.promise, e);
        return;
      }
      resolve(deferred.promise, ret);
    });
  }

  function resolve(self, newValue) {
    try {
      // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self)
        throw new TypeError('A promise cannot be resolved with itself.');
      if (
        newValue &&
        (typeof newValue === 'object' || typeof newValue === 'function')
      ) {
        var then = newValue.then;
        if (newValue instanceof Promise$1) {
          self._state = 3;
          self._value = newValue;
          finale(self);
          return;
        } else if (typeof then === 'function') {
          doResolve(bind(then, newValue), self);
          return;
        }
      }
      self._state = 1;
      self._value = newValue;
      finale(self);
    } catch (e) {
      reject(self, e);
    }
  }

  function reject(self, newValue) {
    self._state = 2;
    self._value = newValue;
    finale(self);
  }

  function finale(self) {
    if (self._state === 2 && self._deferreds.length === 0) {
      Promise$1._immediateFn(function() {
        if (!self._handled) {
          Promise$1._unhandledRejectionFn(self._value);
        }
      });
    }

    for (var i = 0, len = self._deferreds.length; i < len; i++) {
      handle(self, self._deferreds[i]);
    }
    self._deferreds = null;
  }

  /**
   * @constructor
   */
  function Handler(onFulfilled, onRejected, promise) {
    this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
    this.onRejected = typeof onRejected === 'function' ? onRejected : null;
    this.promise = promise;
  }

  /**
   * Take a potentially misbehaving resolver function and make sure
   * onFulfilled and onRejected are only called once.
   *
   * Makes no guarantees about asynchrony.
   */
  function doResolve(fn, self) {
    var done = false;
    try {
      fn(
        function(value) {
          if (done) return;
          done = true;
          resolve(self, value);
        },
        function(reason) {
          if (done) return;
          done = true;
          reject(self, reason);
        }
      );
    } catch (ex) {
      if (done) return;
      done = true;
      reject(self, ex);
    }
  }

  Promise$1.prototype['catch'] = function(onRejected) {
    return this.then(null, onRejected);
  };

  Promise$1.prototype.then = function(onFulfilled, onRejected) {
    // @ts-ignore
    var prom = new this.constructor(noop);

    handle(this, new Handler(onFulfilled, onRejected, prom));
    return prom;
  };

  Promise$1.prototype['finally'] = finallyConstructor;

  Promise$1.all = function(arr) {
    return new Promise$1(function(resolve, reject) {
      if (!isArray(arr)) {
        return reject(new TypeError('Promise.all accepts an array'));
      }

      var args = Array.prototype.slice.call(arr);
      if (args.length === 0) return resolve([]);
      var remaining = args.length;

      function res(i, val) {
        try {
          if (val && (typeof val === 'object' || typeof val === 'function')) {
            var then = val.then;
            if (typeof then === 'function') {
              then.call(
                val,
                function(val) {
                  res(i, val);
                },
                reject
              );
              return;
            }
          }
          args[i] = val;
          if (--remaining === 0) {
            resolve(args);
          }
        } catch (ex) {
          reject(ex);
        }
      }

      for (var i = 0; i < args.length; i++) {
        res(i, args[i]);
      }
    });
  };

  Promise$1.allSettled = allSettled;

  Promise$1.resolve = function(value) {
    if (value && typeof value === 'object' && value.constructor === Promise$1) {
      return value;
    }

    return new Promise$1(function(resolve) {
      resolve(value);
    });
  };

  Promise$1.reject = function(value) {
    return new Promise$1(function(resolve, reject) {
      reject(value);
    });
  };

  Promise$1.race = function(arr) {
    return new Promise$1(function(resolve, reject) {
      if (!isArray(arr)) {
        return reject(new TypeError('Promise.race accepts an array'));
      }

      for (var i = 0, len = arr.length; i < len; i++) {
        Promise$1.resolve(arr[i]).then(resolve, reject);
      }
    });
  };

  // Use polyfill for setImmediate for performance gains
  Promise$1._immediateFn =
    // @ts-ignore
    (typeof setImmediateFunc === 'function' &&
      function(fn) {
        // @ts-ignore
        setImmediateFunc(fn);
      }) ||
    function(fn) {
      setTimeoutFunc(fn, 0);
    };

  Promise$1._unhandledRejectionFn = function _unhandledRejectionFn(err) {
    if (typeof console !== 'undefined' && console) {
      console.warn('Possible Unhandled Promise Rejection:', err); // eslint-disable-line no-console
    }
  };

  function findScript(url, attributes) {
      var currentScript = document.querySelector("script[src=\"".concat(url, "\"]"));
      if (currentScript === null)
          return null;
      var nextScript = createScriptElement(url, attributes);
      // ignore the data-uid-auto attribute that gets auto-assigned to every script tag
      var currentScriptClone = currentScript.cloneNode();
      delete currentScriptClone.dataset.uidAuto;
      // check if the new script has the same number of data attributes
      if (Object.keys(currentScriptClone.dataset).length !==
          Object.keys(nextScript.dataset).length) {
          return null;
      }
      var isExactMatch = true;
      // check if the data attribute values are the same
      Object.keys(currentScriptClone.dataset).forEach(function (key) {
          if (currentScriptClone.dataset[key] !== nextScript.dataset[key]) {
              isExactMatch = false;
          }
      });
      return isExactMatch ? currentScript : null;
  }
  function insertScriptElement(_a) {
      var url = _a.url, attributes = _a.attributes, onSuccess = _a.onSuccess, onError = _a.onError;
      var newScript = createScriptElement(url, attributes);
      newScript.onerror = onError;
      newScript.onload = onSuccess;
      document.head.insertBefore(newScript, document.head.firstElementChild);
  }
  function processOptions(options) {
      var sdkBaseURL = "https://www.paypal.com/sdk/js";
      if (options.sdkBaseURL) {
          sdkBaseURL = options.sdkBaseURL;
          delete options.sdkBaseURL;
      }
      processMerchantID(options);
      var _a = Object.keys(options)
          .filter(function (key) {
          return (typeof options[key] !== "undefined" &&
              options[key] !== null &&
              options[key] !== "");
      })
          .reduce(function (accumulator, key) {
          var value = options[key].toString();
          if (key.substring(0, 5) === "data-") {
              accumulator.dataAttributes[key] = value;
          }
          else {
              accumulator.queryParams[key] = value;
          }
          return accumulator;
      }, {
          queryParams: {},
          dataAttributes: {},
      }), queryParams = _a.queryParams, dataAttributes = _a.dataAttributes;
      return {
          url: "".concat(sdkBaseURL, "?").concat(objectToQueryString(queryParams)),
          dataAttributes: dataAttributes,
      };
  }
  function objectToQueryString(params) {
      var queryString = "";
      Object.keys(params).forEach(function (key) {
          if (queryString.length !== 0)
              queryString += "&";
          queryString += key + "=" + params[key];
      });
      return queryString;
  }
  /**
   * Parse the error message code received from the server during the script load.
   * This function search for the occurrence of this specific string "/* Original Error:".
   *
   * @param message the received error response from the server
   * @returns the content of the message if the string string was found.
   *          The whole message otherwise
   */
  function parseErrorMessage(message) {
      var originalErrorText = message.split("/* Original Error:")[1];
      return originalErrorText
          ? originalErrorText.replace(/\n/g, "").replace("*/", "").trim()
          : message;
  }
  function createScriptElement(url, attributes) {
      if (attributes === void 0) { attributes = {}; }
      var newScript = document.createElement("script");
      newScript.src = url;
      Object.keys(attributes).forEach(function (key) {
          newScript.setAttribute(key, attributes[key]);
          if (key === "data-csp-nonce") {
              newScript.setAttribute("nonce", attributes["data-csp-nonce"]);
          }
      });
      return newScript;
  }
  function processMerchantID(options) {
      var merchantID = options["merchant-id"], dataMerchantID = options["data-merchant-id"];
      var newMerchantID = "";
      var newDataMerchantID = "";
      if (Array.isArray(merchantID)) {
          if (merchantID.length > 1) {
              newMerchantID = "*";
              newDataMerchantID = merchantID.toString();
          }
          else {
              newMerchantID = merchantID.toString();
          }
      }
      else if (typeof merchantID === "string" && merchantID.length > 0) {
          newMerchantID = merchantID;
      }
      else if (typeof dataMerchantID === "string" &&
          dataMerchantID.length > 0) {
          newMerchantID = "*";
          newDataMerchantID = dataMerchantID;
      }
      options["merchant-id"] = newMerchantID;
      options["data-merchant-id"] = newDataMerchantID;
      return options;
  }

  /**
   * Load the Paypal JS SDK script asynchronously.
   *
   * @param {Object} options - used to configure query parameters and data attributes for the JS SDK.
   * @param {PromiseConstructor} [PromisePonyfill=window.Promise] - optional Promise Constructor ponyfill.
   * @return {Promise<Object>} paypalObject - reference to the global window PayPal object.
   */
  function loadScript$1(options, PromisePonyfill) {
      if (PromisePonyfill === void 0) { PromisePonyfill = getDefaultPromiseImplementation(); }
      validateArguments(options, PromisePonyfill);
      // resolve with null when running in Node
      if (typeof window === "undefined")
          return PromisePonyfill.resolve(null);
      var _a = processOptions(options), url = _a.url, dataAttributes = _a.dataAttributes;
      var namespace = dataAttributes["data-namespace"] || "paypal";
      var existingWindowNamespace = getPayPalWindowNamespace(namespace);
      // resolve with the existing global paypal namespace when a script with the same params already exists
      if (findScript(url, dataAttributes) && existingWindowNamespace) {
          return PromisePonyfill.resolve(existingWindowNamespace);
      }
      return loadCustomScript$1({
          url: url,
          attributes: dataAttributes,
      }, PromisePonyfill).then(function () {
          var newWindowNamespace = getPayPalWindowNamespace(namespace);
          if (newWindowNamespace) {
              return newWindowNamespace;
          }
          throw new Error("The window.".concat(namespace, " global variable is not available."));
      });
  }
  /**
   * Load a custom script asynchronously.
   *
   * @param {Object} options - used to set the script url and attributes.
   * @param {PromiseConstructor} [PromisePonyfill=window.Promise] - optional Promise Constructor ponyfill.
   * @return {Promise<void>} returns a promise to indicate if the script was successfully loaded.
   */
  function loadCustomScript$1(options, PromisePonyfill) {
      if (PromisePonyfill === void 0) { PromisePonyfill = getDefaultPromiseImplementation(); }
      validateArguments(options, PromisePonyfill);
      var url = options.url, attributes = options.attributes;
      if (typeof url !== "string" || url.length === 0) {
          throw new Error("Invalid url.");
      }
      if (typeof attributes !== "undefined" && typeof attributes !== "object") {
          throw new Error("Expected attributes to be an object.");
      }
      return new PromisePonyfill(function (resolve, reject) {
          // resolve with undefined when running in Node
          if (typeof window === "undefined")
              return resolve();
          insertScriptElement({
              url: url,
              attributes: attributes,
              onSuccess: function () { return resolve(); },
              onError: function () {
                  var defaultError = new Error("The script \"".concat(url, "\" failed to load."));
                  if (!window.fetch) {
                      return reject(defaultError);
                  }
                  // Fetch the error reason from the response body for validation errors
                  return fetch(url)
                      .then(function (response) {
                      if (response.status === 200) {
                          reject(defaultError);
                      }
                      return response.text();
                  })
                      .then(function (message) {
                      var parseMessage = parseErrorMessage(message);
                      reject(new Error(parseMessage));
                  })
                      .catch(function (err) {
                      reject(err);
                  });
              },
          });
      });
  }
  function getDefaultPromiseImplementation() {
      if (typeof Promise === "undefined") {
          throw new Error("Promise is undefined. To resolve the issue, use a Promise polyfill.");
      }
      return Promise;
  }
  function getPayPalWindowNamespace(namespace) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return window[namespace];
  }
  function validateArguments(options, PromisePonyfill) {
      if (typeof options !== "object" || options === null) {
          throw new Error("Expected an options object.");
      }
      if (typeof PromisePonyfill !== "undefined" &&
          typeof PromisePonyfill !== "function") {
          throw new Error("Expected PromisePonyfill to be a function.");
      }
  }

  function loadScript(options) {
      return loadScript$1(options, Promise$1);
  }
  function loadCustomScript(options) {
      return loadCustomScript$1(options, Promise$1);
  }
  // replaced with the package.json version at build time
  var version = "5.0.2";

  exports.loadCustomScript = loadCustomScript;
  exports.loadScript = loadScript;
  exports.version = version;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

})({});
window.paypalLoadCustomScript = paypalLoadScript.loadCustomScript;
window.paypalLoadScript = paypalLoadScript.loadScript;
