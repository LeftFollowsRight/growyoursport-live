/**
 * fitty v2.4.2 (beautified + ECMA5-compatible)
 * Snugly resizes text to fit its parent container
 * Copyright (c) 2023 Rik Schennink
 */

(function (root, factory) {
  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = factory();
  } else if (typeof define === "function" && define.amd) {
    define(factory);
  } else {
    root.fitty = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  return function (win) {
    if (!win) return;

    // -------------------------------------------------------------------------
    // Helpers (ES5-safe)
    // -------------------------------------------------------------------------

    function toArray(list) {
      return [].slice.call(list);
    }

    function extend(target) {
      target = target || {};
      for (var i = 1; i < arguments.length; i++) {
        var src = arguments[i];
        if (!src) continue;
        for (var k in src) {
          if (Object.prototype.hasOwnProperty.call(src, k)) {
            target[k] = src[k];
          }
        }
      }
      return target;
    }

    function createCustomEvent(name, detail) {
      // CustomEvent is not supported in older browsers, fallback to document.createEvent
      try {
        return new CustomEvent(name, { detail: detail });
      } catch (e) {
        var ev = document.createEvent("CustomEvent");
        ev.initCustomEvent(name, false, false, detail);
        return ev;
      }
    }

    // -------------------------------------------------------------------------
    // Internal state
    // -------------------------------------------------------------------------

    var DIRTY_INIT = 0;
    var DIRTY_MUTATION = 1;
    var DIRTY_LAYOUT = 2;
    var DIRTY_FORCE = 3;

    var instances = [];
    var rafId = null;

    // requestAnimationFrame wrapper
    var requestTick =
      "requestAnimationFrame" in win
        ? function (opts) {
            opts = opts || { sync: false };

            win.cancelAnimationFrame(rafId);

            function run() {
              var activeDirty = instances.filter(function (item) {
                return item.dirty && item.active;
              });
              return process(activeDirty);
            }

            if (opts.sync) return run();

            rafId = win.requestAnimationFrame(run);
          }
        : function () {};

    // Marks all instances as dirty (type) and triggers a tick
    function markAllDirty(type) {
      return function (opts) {
        instances.forEach(function (item) {
          item.dirty = type;
        });
        requestTick(opts);
      };
    }

    // Process a batch of instances
    function process(batch) {
      // Compute styles once
      batch
        .filter(function (item) {
          return !item.styleComputed;
        })
        .forEach(function (item) {
          item.styleComputed = computeStyle(item);
        });

      // Pre-style test and apply fixes if needed
      batch.filter(needsPreStyleFix).forEach(applyStyles);

      // Items that need layout recalculation
      var toLayout = batch.filter(needsLayout);
      toLayout.forEach(calcLayout);
      toLayout.forEach(function (item) {
        applyStyles(item);
        clean(item);
      });
      toLayout.forEach(dispatchFitEvent);
    }

    function clean(item) {
      item.dirty = DIRTY_INIT;
      return item.dirty;
    }

    function calcLayout(item) {
      item.availableWidth = item.element.parentNode.clientWidth;
      item.currentWidth = item.element.scrollWidth;

      item.previousFontSize = item.currentFontSize;

      // Scale font size into [minSize, maxSize]
      var scaled = (item.availableWidth / item.currentWidth) * item.previousFontSize;
      var clamped = Math.min(Math.max(item.minSize, scaled), item.maxSize);
      item.currentFontSize = clamped;

      item.whiteSpace =
        item.multiLine && item.currentFontSize === item.minSize ? "normal" : "nowrap";
    }

    function needsLayout(item) {
      return (
        item.dirty !== DIRTY_LAYOUT ||
        (item.dirty === DIRTY_LAYOUT &&
          item.element.parentNode.clientWidth !== item.availableWidth)
      );
    }

    function computeStyle(item) {
      var cs = win.getComputedStyle(item.element, null);
      item.currentFontSize = parseFloat(cs.getPropertyValue("font-size"));
      item.display = cs.getPropertyValue("display");
      item.whiteSpace = cs.getPropertyValue("white-space");
      return true;
    }

    function needsPreStyleFix(item) {
      var changed = false;

      if (!item.preStyleTestCompleted) {
        // Force a measurable layout for inline elements
        if (/inline-/.test(item.display)) {
          changed = true;
          item.display = "inline-block";
        }

        // Force nowrap while measuring
        if (item.whiteSpace !== "nowrap") {
          changed = true;
          item.whiteSpace = "nowrap";
        }

        item.preStyleTestCompleted = true;
      }

      return changed;
    }

    function applyStyles(item) {
      item.element.style.whiteSpace = item.whiteSpace;
      item.element.style.display = item.display;
      item.element.style.fontSize = item.currentFontSize + "px";
    }

    function dispatchFitEvent(item) {
      var detail = {
        oldValue: item.previousFontSize,
        newValue: item.currentFontSize,
        scaleFactor: item.currentFontSize / item.previousFontSize
      };

      item.element.dispatchEvent(createCustomEvent("fit", detail));
    }

    function onMutation(item, dirtyType) {
      return function (opts) {
        item.dirty = dirtyType;
        if (item.active) requestTick(opts);
      };
    }

    function unsubscribe(item) {
      return function () {
        instances = instances.filter(function (x) {
          return x.element !== item.element;
        });

        if (item.observeMutations && item.observer) {
          item.observer.disconnect();
        }

        item.element.style.whiteSpace = item.originalStyle.whiteSpace;
        item.element.style.display = item.originalStyle.display;
        item.element.style.fontSize = item.originalStyle.fontSize;
      };
    }

    function unfreeze(item) {
      return function () {
        if (!item.active) {
          item.active = true;
          requestTick();
        }
      };
    }

    function freeze(item) {
      return function () {
        item.active = false;
      };
    }

    function observeMutations(item) {
      if (item.observeMutations) {
        item.observer = new MutationObserver(onMutation(item, DIRTY_MUTATION));
        item.observer.observe(item.element, item.observeMutations);
      }
    }

    // -------------------------------------------------------------------------
    // Defaults + public API
    // -------------------------------------------------------------------------

    var defaults = {
      minSize: 16,
      maxSize: 512,
      multiLine: true,
      observeMutations:
        "MutationObserver" in win && {
          subtree: true,
          childList: true,
          characterData: true
        }
    };

    var windowDelayTimer = null;

    function onWindowResize() {
      win.clearTimeout(windowDelayTimer);
      windowDelayTimer = win.setTimeout(markAllDirty(DIRTY_LAYOUT), api.observeWindowDelay);
    }

    var windowEvents = ["resize", "orientationchange"];

    function createInstances(elements, options) {
      var config = extend({}, defaults, options);

      var result = elements.map(function (el) {
        var item = extend({}, config, { element: el, active: true });

        // Init
        item.originalStyle = {
          whiteSpace: item.element.style.whiteSpace,
          display: item.element.style.display,
          fontSize: item.element.style.fontSize
        };

        observeMutations(item);

        item.newbie = true;
        item.dirty = true;

        instances.push(item);

        return {
          element: el,
          fit: onMutation(item, DIRTY_FORCE),
          unfreeze: unfreeze(item),
          freeze: freeze(item),
          unsubscribe: unsubscribe(item)
        };
      });

      requestTick();
      return result;
    }

    function api(input, options) {
      options = options || {};

      if (typeof input === "string") {
        return createInstances(toArray(document.querySelectorAll(input)), options);
      }

      // Single element
      return createInstances([input], options)[0];
    }

    // Observe window changes (setter)
    Object.defineProperty(api, "observeWindow", {
      set: function (enabled) {
        var method = (enabled ? "add" : "remove") + "EventListener";
        windowEvents.forEach(function (evt) {
          win[method](evt, onWindowResize);
        });
      }
    });

    api.observeWindow = true;
    api.observeWindowDelay = 100;

    api.fitAll = markAllDirty(DIRTY_FORCE);

    return api;
  }(typeof window === "undefined" ? null : window);
});