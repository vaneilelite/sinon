/**
  * Spy functions
  *
  * @author Christian Johansen (christian@cjohansen.no)
  * @license BSD
  *
  * Copyright (c) 2010-2013 Christian Johansen
  */
"use strict";

var extend = require("./extend");
var functionName = require("./util/core/function-name");
var functionToString = require("./util/core/function-to-string");
var getPropertyDescriptor = require("./util/core/get-property-descriptor");
var sinonMatch = require("./match");
var deepEqual = require("./util/core/deep-equal").use(sinonMatch);
var spyCall = require("./call");
var timesInWords = require("./util/core/times-in-words");
var wrapMethod = require("./util/core/wrap-method");
var sinonFormat = require("./util/core/format");
var valueToString = require("./util/core/value-to-string");

var push = Array.prototype.push;
var slice = Array.prototype.slice;
var callId = 0;

function spy(object, property, types) {
    var descriptor, i, methodDesc;

    if (!property && typeof object === "function") {
        return spy.create(object);
    }

    if (!object && !property) {
        return spy.create(function () { });
    }

    if (types) {
        descriptor = {};
        methodDesc = getPropertyDescriptor(object, property);

        for (i = 0; i < types.length; i++) {
            descriptor[types[i]] = spy.create(methodDesc[types[i]]);
        }
        return wrapMethod(object, property, descriptor);
    }

    return wrapMethod(object, property, spy.create(object[property]));
}

function matchingFake(fakes, args, strict) {
    if (!fakes) {
        return undefined;
    }

    for (var i = 0, l = fakes.length; i < l; i++) {
        if (fakes[i].matches(args, strict)) {
            return fakes[i];
        }
    }

    return undefined;
}

function incrementCallCount() {
    this.called = true;
    this.callCount += 1;
    this.notCalled = false;
    this.calledOnce = this.callCount === 1;
    this.calledTwice = this.callCount === 2;
    this.calledThrice = this.callCount === 3;
}

function createCallProperties() {
    this.firstCall = this.getCall(0);
    this.secondCall = this.getCall(1);
    this.thirdCall = this.getCall(2);
    this.lastCall = this.getCall(this.callCount - 1);
}

function createProxy(func, proxyLength) {
    // Retain the function length:
    var p;
    if (proxyLength) {
        // Do not change this to use an eval. Projects that depend on sinon block the use of eval.
        // ref: https://github.com/sinonjs/sinon/issues/710
        switch (proxyLength) {
            /*eslint-disable no-unused-vars, max-len*/
            case 1: p = function proxy(a) { return p.invoke(func, this, slice.call(arguments)); }; break;
            case 2: p = function proxy(a, b) { return p.invoke(func, this, slice.call(arguments)); }; break;
            case 3: p = function proxy(a, b, c) { return p.invoke(func, this, slice.call(arguments)); }; break;
            case 4: p = function proxy(a, b, c, d) { return p.invoke(func, this, slice.call(arguments)); }; break;
            case 5: p = function proxy(a, b, c, d, e) { return p.invoke(func, this, slice.call(arguments)); }; break;
            case 6: p = function proxy(a, b, c, d, e, f) { return p.invoke(func, this, slice.call(arguments)); }; break;
            case 7: p = function proxy(a, b, c, d, e, f, g) { return p.invoke(func, this, slice.call(arguments)); }; break;
            case 8: p = function proxy(a, b, c, d, e, f, g, h) { return p.invoke(func, this, slice.call(arguments)); }; break;
            case 9: p = function proxy(a, b, c, d, e, f, g, h, i) { return p.invoke(func, this, slice.call(arguments)); }; break;
            case 10: p = function proxy(a, b, c, d, e, f, g, h, i, j) { return p.invoke(func, this, slice.call(arguments)); }; break;
            case 11: p = function proxy(a, b, c, d, e, f, g, h, i, j, k) { return p.invoke(func, this, slice.call(arguments)); }; break;
            case 12: p = function proxy(a, b, c, d, e, f, g, h, i, j, k, l) { return p.invoke(func, this, slice.call(arguments)); }; break;
            default: p = function proxy() { return p.invoke(func, this, slice.call(arguments)); }; break;
            /*eslint-enable*/
        }
    } else {
        p = function proxy() {
            return p.invoke(func, this, slice.call(arguments));
        };
    }
    p.isSinonProxy = true;
    return p;
}

var uuid = 0;

// Public API
var spyApi = {
    reset: function () {
        if (this.invoking) {
            var err = new Error("Cannot reset Sinon function while invoking it. " +
                                "Move the call to .reset outside of the callback.");
            err.name = "InvalidResetException";
            throw err;
        }

        this.called = false;
        this.notCalled = true;
        this.calledOnce = false;
        this.calledTwice = false;
        this.calledThrice = false;
        this.callCount = 0;
        this.firstCall = null;
        this.secondCall = null;
        this.thirdCall = null;
        this.lastCall = null;
        this.args = [];
        this.returnValues = [];
        this.thisValues = [];
        this.exceptions = [];
        this.callIds = [];
        this.stacks = [];
        if (this.fakes) {
            for (var i = 0; i < this.fakes.length; i++) {
                this.fakes[i].reset();
            }
        }

        return this;
    },

    create: function create(func, spyLength) {
        var name;

        if (typeof func !== "function") {
            func = function () { };
        } else {
            name = functionName(func);
        }

        if (!spyLength) {
            spyLength = func.length;
        }

        var proxy = createProxy(func, spyLength);

        extend(proxy, spy);
        delete proxy.create;
        extend(proxy, func);

        proxy.reset();
        proxy.prototype = func.prototype;
        proxy.displayName = name || "spy";
        proxy.toString = functionToString;
        proxy.instantiateFake = spy.create;
        proxy.id = "spy#" + uuid++;

        return proxy;
    },

    invoke: function invoke(func, thisValue, args) {
        var matching = matchingFake(this.fakes, args);
        var exception, returnValue;

        incrementCallCount.call(this);
        push.call(this.thisValues, thisValue);
        push.call(this.args, args);
        push.call(this.callIds, callId++);

        // Make call properties available from within the spied function:
        createCallProperties.call(this);

        try {
            this.invoking = true;

            if (matching) {
                returnValue = matching.invoke(func, thisValue, args);
            } else {
                returnValue = (this.func || func).apply(thisValue, args);
            }

            var thisCall = this.getCall(this.callCount - 1);
            if (thisCall.calledWithNew() && typeof returnValue !== "object") {
                returnValue = thisValue;
            }
        } catch (e) {
            exception = e;
        } finally {
            delete this.invoking;
        }

        push.call(this.exceptions, exception);
        push.call(this.returnValues, returnValue);
        var err = new Error();
        var stack = err.stack;
        if (!stack) {
            // PhantomJS does not serialize the stack trace until the error has been thrown:
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/Stack
            try {
                throw err;
            } catch (e) {/* empty */}
        }
        push.call(this.stacks, err.stack);

        // Make return value and exception available in the calls:
        createCallProperties.call(this);

        if (exception !== undefined) {
            throw exception;
        }

        return returnValue;
    },

    named: function named(name) {
        this.displayName = name;
        return this;
    },

    getCall: function getCall(i) {
        if (i < 0 || i >= this.callCount) {
            return null;
        }

        return spyCall(this, this.thisValues[i], this.args[i],
                                this.returnValues[i], this.exceptions[i],
                                this.callIds[i], this.stacks[i]);
    },

    getCalls: function () {
        var calls = [];
        var i;

        for (i = 0; i < this.callCount; i++) {
            calls.push(this.getCall(i));
        }

        return calls;
    },

    calledBefore: function calledBefore(spyFn) {
        if (!this.called) {
            return false;
        }

        if (!spyFn.called) {
            return true;
        }

        return this.callIds[0] < spyFn.callIds[spyFn.callIds.length - 1];
    },

    calledAfter: function calledAfter(spyFn) {
        if (!this.called || !spyFn.called) {
            return false;
        }

        return this.callIds[this.callCount - 1] > spyFn.callIds[spyFn.callCount - 1];
    },

    withArgs: function () {
        var args = slice.call(arguments);

        if (this.fakes) {
            var match = matchingFake(this.fakes, args, true);

            if (match) {
                return match;
            }
        } else {
            this.fakes = [];
        }

        var original = this;
        var fake = this.instantiateFake();
        fake.matchingAguments = args;
        fake.parent = this;
        push.call(this.fakes, fake);

        fake.withArgs = function () {
            return original.withArgs.apply(original, arguments);
        };

        for (var i = 0; i < this.args.length; i++) {
            if (fake.matches(this.args[i])) {
                incrementCallCount.call(fake);
                push.call(fake.thisValues, this.thisValues[i]);
                push.call(fake.args, this.args[i]);
                push.call(fake.returnValues, this.returnValues[i]);
                push.call(fake.exceptions, this.exceptions[i]);
                push.call(fake.callIds, this.callIds[i]);
            }
        }
        createCallProperties.call(fake);

        return fake;
    },

    matches: function (args, strict) {
        var margs = this.matchingAguments;

        if (margs.length <= args.length &&
            deepEqual(margs, args.slice(0, margs.length))) {
            return !strict || margs.length === args.length;
        }

        return undefined;
    },

    printf: function (format) {
        var spyInstance = this;
        var args = slice.call(arguments, 1);
        var formatter;

        return (format || "").replace(/%(.)/g, function (match, specifyer) {
            formatter = spyApi.formatters[specifyer];

            if (typeof formatter === "function") {
                return formatter.call(null, spyInstance, args);
            } else if (!isNaN(parseInt(specifyer, 10))) {
                return sinonFormat(args[specifyer - 1]);
            }

            return "%" + specifyer;
        });
    }
};

function delegateToCalls(method, matchAny, actual, notCalled) {
    spyApi[method] = function () {
        if (!this.called) {
            if (notCalled) {
                return notCalled.apply(this, arguments);
            }
            return false;
        }

        var currentCall;
        var matches = 0;

        for (var i = 0, l = this.callCount; i < l; i += 1) {
            currentCall = this.getCall(i);

            if (currentCall[actual || method].apply(currentCall, arguments)) {
                matches += 1;

                if (matchAny) {
                    return true;
                }
            }
        }

        return matches === this.callCount;
    };
}

delegateToCalls("calledOn", true);
delegateToCalls("alwaysCalledOn", false, "calledOn");
delegateToCalls("calledWith", true);
delegateToCalls("calledWithMatch", true);
delegateToCalls("alwaysCalledWith", false, "calledWith");
delegateToCalls("alwaysCalledWithMatch", false, "calledWithMatch");
delegateToCalls("calledWithExactly", true);
delegateToCalls("alwaysCalledWithExactly", false, "calledWithExactly");
delegateToCalls("neverCalledWith", false, "notCalledWith", function () {
    return true;
});
delegateToCalls("neverCalledWithMatch", false, "notCalledWithMatch", function () {
    return true;
});
delegateToCalls("threw", true);
delegateToCalls("alwaysThrew", false, "threw");
delegateToCalls("returned", true);
delegateToCalls("alwaysReturned", false, "returned");
delegateToCalls("calledWithNew", true);
delegateToCalls("alwaysCalledWithNew", false, "calledWithNew");
delegateToCalls("callArg", false, "callArgWith", function () {
    throw new Error(this.toString() + " cannot call arg since it was not yet invoked.");
});
spyApi.callArgWith = spyApi.callArg;
delegateToCalls("callArgOn", false, "callArgOnWith", function () {
    throw new Error(this.toString() + " cannot call arg since it was not yet invoked.");
});
spyApi.callArgOnWith = spyApi.callArgOn;
delegateToCalls("yield", false, "yield", function () {
    throw new Error(this.toString() + " cannot yield since it was not yet invoked.");
});
// "invokeCallback" is an alias for "yield" since "yield" is invalid in strict mode.
spyApi.invokeCallback = spyApi.yield;
delegateToCalls("yieldOn", false, "yieldOn", function () {
    throw new Error(this.toString() + " cannot yield since it was not yet invoked.");
});
delegateToCalls("yieldTo", false, "yieldTo", function (property) {
    throw new Error(this.toString() + " cannot yield to '" + valueToString(property) +
        "' since it was not yet invoked.");
});
delegateToCalls("yieldToOn", false, "yieldToOn", function (property) {
    throw new Error(this.toString() + " cannot yield to '" + valueToString(property) +
        "' since it was not yet invoked.");
});

spyApi.formatters = {
    c: function (spyInstance) {
        return timesInWords(spyInstance.callCount);
    },

    n: function (spyInstance) {
        return spyInstance.toString();
    },

    C: function (spyInstance) {
        var calls = [];

        for (var i = 0, l = spyInstance.callCount; i < l; ++i) {
            var stringifiedCall = "    " + spyInstance.getCall(i).toString();
            if (/\n/.test(calls[i - 1])) {
                stringifiedCall = "\n" + stringifiedCall;
            }
            push.call(calls, stringifiedCall);
        }

        return calls.length > 0 ? "\n" + calls.join("\n") : "";
    },

    t: function (spyInstance) {
        var objects = [];

        for (var i = 0, l = spyInstance.callCount; i < l; ++i) {
            push.call(objects, sinonFormat(spyInstance.thisValues[i]));
        }

        return objects.join(", ");
    },

    "*": function (spyInstance, args) {
        var formatted = [];

        for (var i = 0, l = args.length; i < l; ++i) {
            push.call(formatted, sinonFormat(args[i]));
        }

        return formatted.join(", ");
    }
};

extend(spy, spyApi);

spy.spyCall = spyCall;

module.exports = spy;
