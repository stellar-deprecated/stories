/*
 * stories
 *
 * Copyright (c) 2014-2015 Stellar Development Foundation
 *
 * Licensed under ISC
 */

 "use strict";

// From Crockford: http://javascript.crockford.com/prototypal.html
if (typeof Object.create !== 'function') {
  Object.create = function (o) {
    function F() {}
    F.prototype = o;
    return new F();
  };
}

(function ($, window, document) {
  var Home = {
    /**
      Initialization family
    **/
    init: function(modules, elem) {
      // Default options
      this.options = {
        firstSlide: 0,
        debug: false,
        width: 1920,
        height: 1080,
        zoomPadding: 0,
        zoom: true
      };

      this.modules = {}; // container to hold modules
      this.width = this.options.width;
      this.height = this.options.height;

      // Create the event handling system
      this.initEvents();

      // main dom elements
      this.$container = $(elem);
      this.$ui = this.$container.find('> .ui');
      this.$slidesContainer = this.$container.find('> .slides');
      this.$slides = undefined;
      this.$currentSlide = undefined; // <section>

      // load the slideshow based on what the parameter is
      this.loadSlideshow();

      // load all dependencies from the slideshow config.json
      this.loadAllModules();

      // create progress bar
      this.initProgressBar();

      // Set viewport virtual resolution (1920x1080 and gets scaled/zoomed)
      this.$slidesContainer.css({width: this.width + 'px', height: this.height + 'px'});

      // Initialize first slide
      this.initSlides();

      // Bind key controls
      if (this.options.zoom) { this.bindResizeZoom(); }
      this.bindArrowKeys();
      this.bindSwipe();

      // Enable debug mode
      if (this.options.debug) {
        this.$container.addClass('debug');
      }
    },

    initEvents: function() {
      var eventTarget = {};
      this.on = function(a, b, c) {
        /**
          KLUDGE: I spent 60 minutes debugging this and why apply doesn't work
          console.log(typeof $(eventTarget).on) // function
          $(eventTarget).on.apply(this,[a,b,c]) // Uncaught TypeError: undefined is not a function
          // $(eventTarget).on.apply(this, Array.prototype.slice.call(arguments))
        **/
        $(eventTarget).on(a, b, c);
      }
      this.trigger = function(a, b) {
        $(eventTarget).trigger(a, b)
      }
    },

    // loadSlideshow makes requests to load the slideshow specified in
    // url's GET param show. Looks for these 2 files:
    //   slides.html
    //   config.json
    loadSlideshow: function() {
      // Download the target slideshow
      var urlParam = getParameterByName('show');
      var slug = urlParam.replace(/[^\w-_]+/g,''); // Whitelist input url {}
      if (slug === '') {
        console.error("Missing 'show' GET parameter");
      }
      var targetContent = $.ajax('./content/' + slug + '/slides.html', {'async': false});
      if (targetContent.status == 200) {
        this.$slidesContainer.html(targetContent.responseText);
        this.$slides = this.$container.find('> .slides > section');
      } else {
        console.error("Failed to load slides (file not found)");
      }

      var targetConfig = $.ajax('./content/' + slug + '/config.json', {'async': false});
      if (targetConfig.status == 200) {
        var responseConfig = JSON.parse(targetConfig.responseText);
        if (typeof responseConfig.modules === "undefined" || responseConfig.modules.length === 0) {
          console.error("Config missing modules");
        } else {
          this.moduleList = responseConfig.modules
          if (typeof responseConfig.options !== undefined)
          this.options = $.extend(this.options, responseConfig.options);
        }
      } else {
        console.error("Failed to load slides (config not found)");
      }
    },

    // Contains list of loaded modules to prevent duplicates being loaded.
    // - Key is to the family name (the part before the --, used for
    //   interfaces; or the module name if -- doesn't exist)
    // - Value is the full module name.
    loadedModules: {},

    // Loads a module in two steps:
    //   1. Check and load it's dependencies (recursively)
    //   2. Make a copy to the local
    //   3. Call the entry point (with access to this)
    loadModule: function(moduleName) {
      var moduleFactory = $.fn.stories.modules[moduleName]
      // Check if module exists. Yea, this is kludgey but there will only
      // ever be one slideshow supported
      if (typeof moduleFactory === "undefined") {
        console.error(moduleName + '" not found');
        return
      }

      // Parse the bit before the "--" (if it exists)
      var moduleFamilyMatch = moduleName.match(/^(\w+)--/);
      if (moduleFamilyMatch === null) {
        var moduleFamily = moduleName
      } else {
        var moduleFamily = moduleFamilyMatch[1];
      }

      // Check if the module or family has been loaded already
      if (moduleFamily in this.loadedModules) {
        this.log(moduleName + ' is already loaded as ' + this.loadedModules[moduleFamily]);
        return
      } else {
        this.loadedModules[moduleFamily] = moduleName;
      }

      // Initialize the module
      var newModule = moduleFactory();
      this.modules[moduleName] = newModule;

      // Check for dependencies
      if (typeof newModule.deps !== "undefined") {
        if (Array.isArray(newModule.deps)) {
          // deps exists and is an array
          this.log('loading deps for ' + moduleName)
          for (var i = 0; i < newModule.deps.length; i++) {
            if (newModule.deps[i] !== "") {
              this.loadModule(newModule.deps[i]);
            }
          }
        } else if (typeof newModule.deps === "string") {
          if (newModule.deps !== "") {
            this.log('loading dep for ' + moduleName)
            this.loadModule(newModule.deps);
          }
        } else {
          console.error("unknown type for deps")
          return
        }
      }

      this.log(moduleName + ".entry()")
      this.modules[moduleName].entry.call(this);
    },

    loadAllModules: function() {
      for (var i = 0; i < this.moduleList.length; i++) {
        this.loadModule(this.moduleList[i])
      }
    },

    initProgressBar: function() {
      this.$ui.append('<div class="progress-bar"></div>');
      this.$progressBar = this.$ui.find('.progress-bar');
    },

    initSlides: function() {
      this.currentSlideIndex = 0;
      this.toSlide(this.currentSlideIndex);
    },

    resizeZoom: function() {
      // Get viewport width and height
      var viewportWRaw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      var viewportHRaw = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

      var viewportWPadded = (viewportWRaw - this.options.zoomPadding * 2);
      var viewportHPadded = (viewportHRaw - this.options.zoomPadding * 2);

      var slidesAspectRatio = this.width / this.height;
      var viewportAspectRatio = viewportWPadded / viewportHPadded;

      if (slidesAspectRatio >= viewportAspectRatio) {
        // constrained by viewport width
        console.info('constrained by viewport width');
        this.$slidesContainer.css('zoom', viewportWPadded / this.width);
      } else {
        // constrained by viewport height
        console.info('constrained by viewport height');
        this.$slidesContainer.css('zoom', viewportHPadded / this.height);
      }
    },

    bindResizeZoom: function() {
      this.resizeZoom();
      $(window).on('resize orientationChanged', this.resizeZoom.bind(this));
    },

    bindArrowKeys: function() {
      $(document).keydown(function(e) {
        switch(e.which) {
          case 32: // spacebar
          this.nextSlide();
          break;

          case 37: // left
          this.prevSlide();
          break;

          case 39: // right
          this.nextSlide();
          break;

          default: return; // exit this handler for other keys
        }
        e.preventDefault(); // prevent the default action (scroll / move caret)
      }.bind(this));
    },

    bindSwipe: function() {
      if (typeof $.fn.swipe === 'undefined') {
        // We don't have touchswipe plugin
        return;
      }

      this.$slidesContainer.swipe({
        swipe: function(event, direction, distance, duration, fingerCount) {
          if (direction === "left") {
            this.nextSlide();
          } else if (direction === "right") {
            this.prevSlide();
          }
        }.bind(this)
      });
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

    prevSlide: function() {
      this.toSlide(this.currentSlideIndex - 1);
    },

    nextSlide: function() {
      this.toSlide(this.currentSlideIndex + 1);
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

      // Set background
      this.trigger("slide.change", $targetSlide)

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

      // Progress bar
      this.calculateProgressBar();
    },

    calculateProgressBar: function() {
      var percentage = (this.currentSlideIndex) / (this.$slides.length - 1) * 100;
      this.$progressBar.css('width', percentage + '%');
    },

    log: function(logString) {
      if (this.options.debug) {
        var stackTrace = (new Error()).stack; // Only tested in latest FF and Chrome
        var callerName = stackTrace.replace(/^Error\s+/, ''); // Sanitize Chrome
        callerName = callerName.split("\n")[1]; // 1st item is this, 2nd item is caller
        callerName = callerName.replace(/^\s+at Object./, ''); // Sanitize Chrome
        callerName = callerName.replace(/ \(.+\)$/, ''); // Sanitize Chrome
        callerName = callerName.replace(/\@.+/, ''); // Sanitize Firefox

        var matchModule = callerName.match(/^\$\.fn\.stories\.modules\.((?:\w|-)+)/)
        if (matchModule !== null) {
          console.log("[" + matchModule[1] + "] " + logString)
        } else if (callerName == "Home.loadModule") {
          console.log("[loadModule] " + logString)
        } else {
          console.log(logString)
        }
      }
    },
  }; // end var Home

  // Initialization
  $.fn.stories = function() {
    this.each(function () {
      var home = Object.create(Home);
      var modules = $.extend($.fn.stories.modules, {});
      home.init(modules, this);
    });
  };

  $.fn.stories.modules = {};
}(jQuery, window, document));

// Helper function for GET parameter
function getParameterByName(name) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
    results = regex.exec(location.search);
  return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}
