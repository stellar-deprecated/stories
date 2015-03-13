/*
 * stories
 *
 * Copyright (c) 2014-2015 Stellar Development Foundation
 *
 * Licensed under ISC
 */
"use strict";

var stories = (function() {
  var stories = {};

  stories.newStory = function(config) {
    return Object.create({
      /**
        Initialization family
      **/
      init: function(elem) {
        // Default options
        this.options = {
          firstSlide: 0,
          debug: false,
          width: 1920,
          height: 1080,
          zoomPadding: 0
        };

        this.modules = {}; // container to hold modules
        this.moduleList = config.modules;
        this.options = $.extend(this.options, config.options);

        this.width = this.options.width;
        this.height = this.options.height;

        // Create the event handling system
        this.initEvents();

        // main dom elements
        this.$container = $(elem);
        this.initUILayers();
        this.$slidesContainer = this.$container.find('> .slides');
        this.$slides = this.$container.find('> .slides > section');
        this.$currentSlide = undefined; // <section>

        // load all dependencies from the slideshow config.json
        this.loadAllModules();

        // Set viewport virtual resolution (1920x1080 and gets scaled/zoomed)
        this.$slidesContainer.css({width: this.width + 'px', height: this.height + 'px'});

        // Initialize first slide
        this.initSlides();

        // Enable debug mode
        if (this.options.debug) {
          this.$container.addClass('debug');
        }
      },

      initUILayers: function() {
        this.$ui = $('<div class="ui"></div>').prependTo(this.$container);
      },

      events: {},

      initEvents: function() {
        var eventTarget = {};
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
        var definedModule = stories.get(moduleName)
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
        "events": function(moduleName) {
          return this.events;
        },
        "uiLayer": function(moduleName) {
          return $('<div class="ui-layer ' + this.getModuleFamily(moduleName) + ' ' + moduleName + '"></div>').prependTo(this.$ui);
        }
      },

      initSlides: function() {
        this.currentSlideIndex = 0;
        this.toSlide(this.currentSlideIndex);
      },

      /**
        Runtime tools
      **/
      isIndexInBounds: function(targetSlideIndex) {
        // Check bounds
        if (targetSlideIndex < 0 || targetSlideIndex >= this.$slides.length) {
          this.log('target slide out of bounds');
          return false;
        } else {
          return true;
        }
      },

      // Attempts to go to a target slide. Handles edgecases
      toSlide: function(targetSlideIndex) {
        if (!this.isIndexInBounds(targetSlideIndex)) {
          return;
        }

        // Save target slide element
        var $targetSlide = $(this.$slides[targetSlideIndex]);

        // Set visibility
        if (typeof this.$currentSlide !== 'undefined') {
          this.$currentSlide.removeClass('visible');
        }
        $targetSlide.addClass('visible');

        // Set internal state variables
        this.$currentSlide = $targetSlide;
        this.currentSlideIndex = targetSlideIndex;

        // State css classes helpers
        if (this.currentSlideIndex === 0) {
          this.$container.addClass('first-slide');
        } else {
          this.$container.removeClass('first-slide');
        }

        if (this.currentSlideIndex === this.$slides.length - 1) {
          this.$container.addClass('last-slide');
        } else {
          this.$container.removeClass('last-slide');
        }

        // Set background
        this.events.trigger("slide.change", $targetSlide)
      },

      log: function(logString) {
        if (this.options.debug) {
          var stackTrace = (new Error()).stack; // Only tested in latest FF and Chrome
          if (typeof stackTrace !== 'undefined') { // IE10 does not have stacktrace
            var callerName = stackTrace.replace(/^Error\s+/, ''); // Sanitize Chrome
            callerName = callerName.split("\n")[1]; // 1st item is this, 2nd item is caller
            callerName = callerName.replace(/^\s+at Object./, ''); // Sanitize Chrome
            callerName = callerName.replace(/ \(.+\)$/, ''); // Sanitize Chrome
            callerName = callerName.replace(/\@.+/, ''); // Sanitize Firefox

            var matchModule = callerName.match(/^\$\.fn\.stories\.modules\.((?:\w|-)+)/);
            if (matchModule !== null) {
              console.log("[" + matchModule[1] + "] " + logString);
            } else if (callerName == "Home.loadModule") {
              console.log("[loadModule] " + logString);
            } else {
              console.log(logString);
            }
          } else {
            console.log(logString);
          }
        }
      },
    });
  };

  stories.moduleManager = (function() {
    var modules = {};

    return {
      // similar to the AMD.js define except that the id field is required
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

  stories.define = stories.moduleManager.define;
  stories.get = stories.moduleManager.get;
  delete stories.moduleManager;

  return stories;
})();

(function ($, window, document) {
  // Initialization
  $.fn.stories = function(config) {
    this.each(function (k, v) {
      var thisStory = stories.newStory(config);
      thisStory.init(v);
    });
  };
}(jQuery, window, document));
