/*
 * storyteller.js
 * https://github.com/stellar/stories
 *
 * Copyright (c) 2014-2015 Stellar Development Foundation
 *
 * Licensed under ISC
 */
"use strict";

var storyteller = (function() {
  var storyteller = {};

  storyteller.newStory = function(config) {
    return Object.create({
      /**
        Initialization family
      **/
      init: function(elem) {
        // Extend options from defaults
        this.options = $.extend({
          debug: false
        }, config.options);

        // Enable debug mode
        if (this.options.debug) {
          // console.clear();
        }

        this.moduleList = config.modules;

        // Create the event handling system
        this.initEvents();

        // Create the debug logger
        this.createLogger();

        // Initialize and save main dom elements
        this.$container = $(elem);
        this.$slidesContainer = this.$container.find('> .slides');
        this.$slides = this.$container.find('> .slides > section');
        this.$slidesContainer.wrap('<div class="viewport"></div>');
        this.$viewport = this.$container.find('> .viewport');
        this.initUILayers();

        // Enable debug mode
        if (this.options.debug) {
          this.$container.addClass('debug');
        }

        // load all dependencies from the slideshow config.json
        this.loadAllModules();

        this.$container.addClass('is-init');

        // Let modules know that they are ready
        this.events.trigger('init');
      },

      initUILayers: function() {
        this.$uiOverlay = $('<div class="ui-overlay"></div>').appendTo(this.$container);
        this.$uiUnderlay = $('<div class="ui-underlay"></div>').prependTo(this.$container);
      },

      initEvents: function() {
        var eventTarget = {};
        this.events = {};
        this.events.on = function(a, b, c) {
          /**
            KLUDGE: I spent 60 minutes debugging this and why apply doesn't work
            console.log(typeof $(eventTarget).on) // function
            $(eventTarget).on.apply(this,[a,b,c]) // Uncaught TypeError: undefined is not a function
            // $(eventTarget).on.apply(this, Array.prototype.slice.call(arguments))
          **/
          $(eventTarget).on(a, b, c);
        }
        this.events.trigger = function(a, b) {
          $(eventTarget).trigger(a, b)
        }
      },

      // Contains list of loaded modules to prevent duplicates being loaded.
      // - Key is to the family name (the part before the --, for exclusive
      //   interfaces; or the module name if -- doesn't exist)
      // - Value is the full module name.
      loadedModules: {},

      // Loads a module in two steps:
      //   1. Check and load it's dependencies (recursively)
      //   2. Make a copy to the local
      //   3. Call the entry point (with access to this)
      loadModule: function(moduleName) {
        var definedModule = storyteller.get(moduleName)
        if (typeof definedModule === "undefined") {
          console.error('module "' + moduleName + '" not found');
          return
        }

        // Parse the bit before the "--" (if it exists)
        var moduleFamily = this.getModuleFamily(moduleName);

        // Check if the module or family has been loaded already
        if (moduleFamily in this.loadedModules) {
          this.log(moduleName + ' is already loaded as ' + this.loadedModules[moduleFamily]);
          return
        } else {
          this.loadedModules[moduleFamily] = moduleName;
        }

        // Copy over the factory to reserve the name
        this.modules[moduleName] = definedModule.factory();

        // Check for dependencies
        if (typeof definedModule.deps !== "undefined") {
          if (Array.isArray(definedModule.deps)) {
            // deps exists and is an array
            this.log('loading deps for ' + moduleName)
            for (var i = 0; i < definedModule.deps.length; i++) {
              if (definedModule.deps[i] !== "") {
                this.loadModule(definedModule.deps[i]);
              }
            }
          } else if (typeof definedModule.deps === "string") {
            if (definedModule.deps !== "") {
              this.log('loading dep for ' + moduleName)
              this.loadModule(definedModule.deps);
            }
          } else {
            console.error("unknown type for deps")
            return
          }
        }

        this.$container.addClass('stories--' + moduleName);

        this.log(moduleName + ".entry()")
        var tools = this.generateModuleTools(moduleName, this.modules[moduleName].tools);
        this.modules[moduleName].entry(tools);
      },

      getModuleFamily: function(moduleName) {
        var moduleFamilyMatch = moduleName.match(/^(\w+)--/);
        if (moduleFamilyMatch === null) {
          return moduleName;
        } else {
          return moduleFamilyMatch[1];
        }
      },

      loadAllModules: function() {
        this.modules = {}; // container to hold modules
        for (var i = 0; i < this.moduleList.length; i++) {
          this.loadModule(this.moduleList[i])
        }
      },

      // initialize the tools requested by the module
      generateModuleTools: function(moduleName, toolList) {
        if (!Array.isArray(toolList)) {
          return {};
        }

        var outputTools = {};
        for (var i = 0; i < toolList.length; i++) {
          var reqTool = toolList[i];
          if (reqTool in this.moduleTools) {
            outputTools[reqTool] = this.moduleTools[reqTool].call(this, moduleName);
          }
        }
        return outputTools;
      },

      // the actual tools definitions
      moduleTools: {
        "this": function() {
          return this;
        },
        "log": function() {
          // TODO: personalize logger for each module (prepend string output with module name)
          return this.log;
        },
        "events": function() {
          return this.events;
        },
        "options": function() {
          return this.options;
        },
        "$slidesContainer": function() {
          return this.$slidesContainer;
        },
        "slides": function() {
          // TODO: make a copy so it's not mutable between modules
          return this.$slides;
        },
        "$slides": function() {
          // TODO: better looking way of distinguishing between elements and jQuery wrapped
          var $slides = []; // http://jsperf.com/eq-vs-vs-vanilla
          for (var i = 0; i < this.$slides.length; i++) {
            $slides[i] = $(this.$slides[i]);
          }
          return $slides
        },
        "$uiOverlay": function(moduleName) {
          return $('<div class="ui-layer ' + moduleName + '"></div>').prependTo(this.$uiOverlay);
        },
        "$uiUnderlay": function(moduleName) {
          return $('<div class="ui-layer ' + moduleName + '"></div>').prependTo(this.$uiUnderlay);
        },
        "$viewport": function() {
          return this.$viewport;
        }
      },

      createLogger: function() {
        if (this.options.debug && typeof console.log !== 'undefined') {
          this.log = console.log.bind(console);
        } else {
          this.log = function() {} // don't log
        }
      },
    });
  };

  storyteller.moduleManager = (function() {
    var modules = {};

    return {
      // similar to the AMD api define except that the id field is required
      // all modules should be cleaned and have expected types
      define: function() {
        if (arguments.length === 2) {
          var id = arguments[0];
          var dependencies = undefined;
          var factory = arguments[1];
        } else if (arguments.length === 3) {
          var id = arguments[0];
          var dependencies = arguments[1];
          var factory = arguments[2];
        } else {
          return;
        }

        var validID = typeof id === "string" && id.length > 0;
        var validFactory = typeof factory === "function";
        var alreadyDefined = typeof id === "string" && id in modules;
        var depsIsArray = Array.isArray(dependencies);

        if (validID && validFactory) {
          modules[id] = {
            "id": id,
            "deps": [],
            "factory": factory
          };

          if (depsIsArray && dependencies.length > 0) {
            for (var i = 0; i < dependencies.length; i++) {
              var validDependency = typeof dependencies[i] === "string" && dependencies[i].length > 0;
              if (validDependency) {
                modules[id].deps.push(dependencies[i])
              }
            }
          }
        }
      },

      get: function(id) {
        if (id in modules) {
          return modules[id]
        }
      },
    }
  })()

  storyteller.define = storyteller.moduleManager.define;
  storyteller.get = storyteller.moduleManager.get;
  delete storyteller.moduleManager;

  return storyteller;
})();

(function ($, window, document) {
  $.fn.storyteller = function(config) {
    this.each(function (k, v) {
      storyteller.newStory(config).init(v);
    });
  };
}(jQuery, window, document));
