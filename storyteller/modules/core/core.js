storyteller.define('storyline-linear', function() {
  var module = this;
  var t;

  module.currentSlideIndex = 0;
  module.totalSlides = 0;

  // Attempts to go to a target slide. Handles edgecases
  module.toSlide = function(input) {
    var targetSlideIndex;

    // resolve input to a validated index
    if (typeof input.index !== 'undefined') {
      if (!$.isNumeric(input.index)) {
        console.error('index must be a number. got: ' + input.index);
        return;
      }

      var parsedInputIndex = parseInt(input.index, 10);
      if (isNaN(parsedInputIndex) || parsedInputIndex !== input.index) {
        console.error('index must be an integer. got: ' + input.index);
        return
      }

      var indexOutOfBounds = parsedInputIndex < 0 || parsedInputIndex >= module.totalSlides;
      if (indexOutOfBounds) {
        t.log('target slide out of bounds. got: ' + input.index);
        return;
      }

      targetSlideIndex = parsedInputIndex;
    } else if (typeof input.percent !== 'undefined') {
      if (!$.isNumeric(input.percent)) {
        console.error('percent must be a number. got: ' + input.percent);
        return;
      }
      if (input.percent <= 0) {
        console.error('received input of less than 0 percent');
        return;
      }
      if (input.percent >= 100) {
        console.error('received input of greater than 0 percent');
        return;
      }
      targetSlideIndex = Math.round((input.percent/100) * (module.totalSlides - 1));
    } else {
      // For compatibility, this is not an error
      t.log('no input for toSlide. got: ' + JSON.stringify(input));
    }

    if (module.currentSlideIndex === targetSlideIndex && !input.force) {
      t.log('target slide is same as current slide');
      return;
    }

    // Save target slide element
    var oldSlideIndex = module.currentSlideIndex;
    var $targetSlide = $(t.$slides[targetSlideIndex]);

    module.currentSlideIndex = targetSlideIndex;

    t.events.trigger("storyline:change", {
      fromIndex: oldSlideIndex,
      toIndex: module.currentSlideIndex,
      totalSlides: module.totalSlides,
      $targetSlide: $targetSlide,
    });
  };

  return {
    tools: ['$slides', 'events', 'log'],
    entry: function(tools) {
      t = tools;
      t.events.on('init', function() {
        module.totalSlides = t.$slides.length;
        module.toSlide({
          index: module.currentSlideIndex,
          force: true
        });
        // t.events.trigger("storyline:info", { // TODO: a better way of communicating state
        //   // currently unused. perhaps cross module state should not even be shown?
        //   totalSlides: module.totalSlides,
        // });
      });
      t.events.on('control:jump', function(e, jump) {
        module.toSlide(jump);
      });
      t.events.on('control:advance', function(e, advance) {
        module.toSlide({
          index: module.currentSlideIndex + advance.amount
        });
      });
      t.events.on('control:next', function() {
        module.toSlide({
          index: module.currentSlideIndex + 1
        });
      });
      t.events.on('control:prev', function() {
        module.toSlide({
          index: module.currentSlideIndex - 1
        });
      });
    }
  }
});

storyteller.define('transition-fade', function() {
  return {
    tools: ['events', 'slides'],
    entry: function(t) {
      t.events.on("storyline:change", function(e, change) {
        // TODO: slides vs $slides
        // TODO: see if performance is an issue; if so, improve
        t.slides.removeClass('visible');
        change.$targetSlide.addClass('visible');
      });
    }
  }
});

// Module exists just for the css
storyteller.define('slide-full', function() {
  return {
    entry: function() {
    }
  }
});

// Card shaped slides
storyteller.define('slide-cards', function() {
  var self = this;
  var t;

  // TODO: configurable options
  // hardcoded for now
  self.options = {
    slideMarginHorizontal: 8,
    slideMarginVertical: 8,
    // registeredPadding: { // TODO: ui padding registration tool
    //   'bottom': 16 //px
    // },
    virtualWidth: 360,
    virtualHeight: 640
  };

  // save the state of the storyline
  self.storyline = {
    curSlideIndex: 0,
    totalSlides: 0,
  };

  /*
    Calculations are required to correct position and size the cards. Here is a
    overview of how the calculations flow:
      - `calcSlideLayout`: calculate layout
        - if card is bounded by container
          - result: only 1 card
          - calculate: card size (fitting into the container)
        - if card is bounded by height
          - calculate: number of cards
          - calculate: card size
      - `calcSlidePositions`: calculate slide positions based on results of calcSlideLayout
        - calculate: x and y position of each card
  */

  /*
    calcSlideLayout calculates the number of cards and scale of each card. Then,
    it will save these calculations. Then, it will invoke calcSlidePositions()
    since previous calculations have been invalidated by these new layouts.
  */
  self.calcSlideLayout = function() {
    self.slideLayout = {};
    // alias to reduce code verbosity
    var layout = self.slideLayout;
    var opts = self.options;

    // extrapolate givens
    layout.aspectRatio = opts.virtualWidth / opts.virtualHeight;

    // calculate container size
    layout.viewportWidth = t.$slidesContainer.width();
    layout.viewportHeight = t.$slidesContainer.height(); // - self.options.registeredPadding.bottom;

    // calculate if we are bounded by container width or height
    // here, we take a guess that it is bounded by width
    var slideWidthGuess = layout.viewportWidth - 2 * opts.slideMarginHorizontal;
    var slideHeightGuess = slideWidthGuess / layout.aspectRatio;
    var slideOuterHeightGuess = slideHeightGuess + 2 * opts.slideMarginVertical;

    // if height is less than the viewport, then our guess was correct
    layout.boundByWidth = (slideOuterHeightGuess < layout.viewportHeight);

    // Calculate the sizes of each card
    if (layout.boundByWidth) {
      layout.slideWidth = layout.viewportWidth - 2 * opts.slideMarginHorizontal;
      layout.slideHeight = layout.slideWidth / layout.aspectRatio;
      layout.scale = layout.slideWidth / opts.virtualWidth;
    } else {
      layout.slideHeight = layout.viewportHeight - 2 * opts.slideMarginVertical;
      layout.slideWidth = layout.slideHeight * layout.aspectRatio;
      layout.scale = layout.slideHeight / opts.virtualHeight; // less precision loss
    }

    if (layout.boundByWidth) {
      // bounded by width automatically means only 1 card at a time
      layout.numCards = 1;
    } else {
      // we could fit one or more cards per page
      // solve for n: layout.viewportWidth = n*layout.slideWidth + (n+1) * self.options.slideMarginHorizontal
      layout.numCards = Math.floor(
        (layout.viewportWidth - opts.slideMarginHorizontal)
        /
        (layout.slideWidth + opts.slideMarginHorizontal)
      );
    }

    self.calcSlidePositions();
  }

  /*
    results of `calcSlideLayout()` saved here
    example slideLayout data:
    ```
      {
        aspectRatio: 0.5625
        boundByWidth: false
        numCards: 2
        scale: 0.68203125
        slideHeight: 873
        slideWidth: 491.0625
        viewportHeight: 913
        viewportWidth: 1491
      }
    ```
  */
  self.slideLayout = {};

  /*
    calcSlidePositions calculates the x and y position of each card based on the
    layout as calculated by calcSlideLayout().
  */
  self.calcSlidePositions = function() {
    self.slidePositions = []; // reset the slide positions
    // alias to reduce code verbosity
    var layout = self.slideLayout;
    var opts = self.options;


    // calculate offsets relevant to all slides
    // innerContentWidth is the total size of all the slides on screen and margins between these slides
    var innerContentWidth =
      layout.numCards * layout.slideWidth + // slide sizes
      (layout.numCards-1) * opts.slideMarginHorizontal; // slide margins

    // slideXOffset is the horizontal distance between the viewport and the left slide on the screen
    if (layout.numCards == 1) {
      var slideXOffset = (layout.viewportWidth - innerContentWidth) / 2;
    } else {
      // First slide starts on the left
      var slideXOffset = opts.slideMarginHorizontal;
      // For centered slides: // (layout.viewportWidth - innerContentWidth) / 2;
    }

    // navigatedSlideOffset is the offset caused by the current card we have navigated to
    var navigatedSlideOffset = self.storyline.curIndex * (layout.slideWidth + opts.slideMarginHorizontal);

    // calculate offsets relevant to individual slides
    for (var i = 0; i < self.storyline.totalSlides; i++) {
      var thisSlideOffset = (i) * (layout.slideWidth + opts.slideMarginHorizontal);

      self.slidePositions[i] = {
        x: slideXOffset - navigatedSlideOffset + thisSlideOffset,
        y: (layout.viewportHeight - layout.slideHeight) / 2
      };
    }
  };

  /*
    results of `calcSlidePositions()` saved here
    slideLayout data structure:
    ```
      {
        x: int,
        y: int,
      }
    ```
  */
  self.slidePositions = [];

  // Aassumes that the array is the same length as the number of slides
  self.applySlideTransforms = function() {
    // TODO: optimize performance here
    for (var i = 0; i < self.storyline.totalSlides; i++) {
      var curPositions = self.slidePositions[i];

      // Chrome renders things blurry if it is translated by half a pixel.
      // Round so that things will render more clearly
      curPositions.x = Math.round(curPositions.x);
      curPositions.y = Math.round(curPositions.y);

      var transformProp = 'translate(' + curPositions.x + 'px ,' + curPositions.y + 'px) scale(' + self.slideLayout.scale + ')';
      t.$slides[i].css({
        '-webkit-transform': transformProp,
                'transform': transformProp
      });
    }
  }

  return {
    tools: ['$slidesContainer', '$slides', 'events'],
    entry: function(tools) {
      t = tools;
      t.events.trigger('viewport:register-options', {
        'caller': 'slide-cards', // TODO: personalized events to automatically include caller
        'options': {
          'paddingBottom': 32
        }
      });

      // TODO: better story around communiating with storyline
      self.storyline.totalSlides = t.$slides.length;
      t.events.on('storyline:change', function(e, change) {
        self.storyline.curIndex = change.toIndex;
        self.storyline.totalSlides = change.totalSlides;

        self.calcSlidePositions();
        self.applySlideTransforms();
      });

      t.events.on('init', function() {
        self.calcSlideLayout();
        self.applySlideTransforms();
        t.$slidesContainer.addClass('ready');

        $(window).on('resize orientationChanged', function() {
          self.calcSlideLayout();
          self.applySlideTransforms();
        });
      });
    }
  }
});


// Modular ui bar for others to register on to
storyteller.define('control-dock', function() {
  var module = this; // TODO: better name for "module" (perhaps "self")
  var t;

  // A submodule
  module.progressBar = {
    container: {},
    barMin: {},
    barMax: {},
    init: function() {
      module.progressBar.$container = $('<div class="control-dock-progressBar"></div>').prependTo(t.$uiOverlay);
      module.progressBar.$barMin = $('<div class="bar-min"></div>').prependTo(module.progressBar.$container);
      module.progressBar.$barMax = $('<div class="bar-max"></div>').prependTo(module.progressBar.$container);
      t.events.on('storyline:change', module.progressBar.calcProgressBar);
      module.progressBar.$container.on('click', module.progressBar.handleProgressBar);
    },
    calcProgressBar: function(e, change) {
      var percentage = (change.toIndex) / (change.totalSlides - 1) * 100;
      module.progressBar.$barMin.css('width', percentage + '%');
    },
    // Handle event for progress bar clicks
    handleProgressBar: function(e) {
      var targetPercent = e.offsetX/module.progressBar.$container.width() * 100;
      t.events.trigger('control:jump', {percent: targetPercent});
    }
  };

  // A submodule
  module.gridView = {
    init: function() {
      module.$gridViewButton = $('<div class="control-dock-gridView"></div>').appendTo(t.$uiOverlay);
      module.$gridViewButton.on('click', function() {
        t.events.trigger('gridView:enter');
      });
    }
  };

  // A submodule
  module.fullScreen = {
    init: function() {
      module.$fullScreenButton = $('<div class="control-dock-fullScreen"></div>').appendTo(t.$uiOverlay);
      module.$fullScreenButton.on('click', function() {
        t.events.trigger('fullScreen:enter');
      })
    }
  };

  return {
    tools: ['$uiOverlay', 'events'],
    entry: function(tools) {
      t = tools;

      module.progressBar.init();
      module.gridView.init();
      module.fullScreen.init();
    }
  }
});

// left right navigation buttons
storyteller.define('control-navButtons', function() {
  return {
    tools: ['$uiOverlay', 'events'],
    entry: function(t) {
      var $navPrev = $('<div class="nav-prev"></div>').prependTo(t.$uiOverlay);
      var $navNext = $('<div class="nav-next"></div>').prependTo(t.$uiOverlay);

      $navPrev.click(function() {
        t.events.trigger('control:prev');
      });
      $navNext.click(function() {
        t.events.trigger('control:next');
      });

      t.events.on("storyline:change", function(e, change) {
        if (change.toIndex === 0) {
          t.$uiOverlay.addClass('first-slide');
        } else if (change.toIndex === change.totalSlides - 1) {
          t.$uiOverlay.addClass('last-slide');
        } else {
          t.$uiOverlay.removeClass('first-slide');
          t.$uiOverlay.removeClass('last-slide');
        }
      });
    },
  };
});

// Background based on the current slide
storyteller.define('display-background', function() {
  var self = this;
  var t;

  // TODO: better way of handling options in storyteller.js (built in)
  self.options = {
    "type": "contextual",
      // static: based on a setting in the config
      // contextual: based on what the current slide specifies
      // TODO: improve how contextual backgrounds are handled
    "color": "#000",
  };
  self.updateBackground = function(e, change) {
    t.$uiUnderlay.attr({'template': change.$targetSlide.attr('template')});
  };

  return {
    tools: ['options', 'events', '$uiUnderlay'],
    entry: function(tools) {
      t = tools;
      $.extend(self.options, t.options.background);

      if (self.options.type === "contextual") {
        t.events.on("storyline:change", self.updateBackground);
      } else if (self.options.type === "static") {
        t.$uiUnderlay.css({'background': self.options.color});
        // TODO: Sanitize input? For untrusted slideshow makers
      } else {
        console.error('Invalid background type specified. Got: ' + self.options.type);
      }
    },
  };
});

// Bottom blue bar
storyteller.define('control-progressBar-thin', function() {
  var module = this;
  var t;
  module.calcProgressBar = function(e, change) {
    var percentage = (change.toIndex) / (change.totalSlides - 1) * 100;
    t.$uiOverlay.css('width', percentage + '%');
  };

  return {
    tools: ['$uiOverlay', 'events'],
    entry: function(tools) {
      t = tools;
      t.events.on("storyline:change", module.calcProgressBar);
    },
  };
});

// zoomable fixed viewport
storyteller.define('viewport-fixed', function() {
  var module = this;
  var t;

  // TODO: make fixed viewport size and padding configurable
  module.width = 1920;
  module.height = 1080;
  module.zoomPadding = 0;

  // The method we use for resizeZoom depends on which browser it is being
  // displayed in. We will try to use css3 transforms and if it is not
  // available, we will use zoom
  module.resizeZoomFactory = function() {
    var styleMethods = {
      simpleZoom: function(viewportWPadded, viewportHPadded, slidesAspectRatio, viewportAspectRatio) {
        if (slidesAspectRatio >= viewportAspectRatio) { // constrained by viewport width; vertically center
          var zoom = viewportWPadded / module.width;
          var marginTop = (viewportHPadded - (viewportWPadded/slidesAspectRatio)) / 2 + 'px';
          var marginLeft = 0;
        } else { // constrained by viewport height; horizontally center
          var zoom = viewportHPadded / module.height
          var marginTop = 0;
          var marginLeft = ((viewportWPadded - viewportHPadded*slidesAspectRatio)) / 2 + 'px';
        }
        t.$slidesContainer.css({
          'zoom': zoom,
          'margin-top': marginTop,
          'margin-left': marginLeft
        });
      },
      transformScale: function(viewportWPadded, viewportHPadded, slidesAspectRatio, viewportAspectRatio) {
        if (slidesAspectRatio >= viewportAspectRatio) { // constrained by viewport width; vertically center
          var scaleAmount = viewportWPadded / module.width;
          var resizeTransform = 'scale(' + scaleAmount + ')';
          var resizeTranslate = 'translate(' +
            0 + ',' +
            ((viewportHPadded - viewportWPadded/slidesAspectRatio) / 2) / scaleAmount + 'px' +
          ')';
        } else { // constrained by viewport height; horizontally center
          var scaleAmount = viewportHPadded / module.height;
          var resizeTransform = 'scale(' + scaleAmount + ')';
          var resizeTranslate = 'translate(' +
            ((viewportWPadded - viewportHPadded*slidesAspectRatio) / 2) / scaleAmount + 'px' + ',' +
            0 +
          ')';
        }
        t.$slidesContainer.css({
          '-webkit-transform': resizeTransform + ' ' + resizeTranslate,
          'transform': resizeTransform + ' ' + resizeTranslate
        });
      }
    };

    // supportsTransforms is a snippet from zoom.js (http://lab.hakim.se/zoom-js); MIT licensed
    var supportsTransforms =  'WebkitTransform' in document.body.style ||
      'MozTransform' in document.body.style ||
      'msTransform' in document.body.style ||
      'OTransform' in document.body.style ||
      'transform' in document.body.style;
    var IE10 = false;
    if (/*@cc_on!@*/false) {
      IE10 = true;
    }

    if (IE10 || !supportsTransforms) {
      var preferredStyleMethod = styleMethods.simpleZoom.bind(this);
    } else {
      var preferredStyleMethod = styleMethods.transformScale.bind(this);
    }

    return function() {
      // Get viewport width and height
      var viewportWRaw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      var viewportHRaw = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

      var viewportWPadded = (viewportWRaw - module.zoomPadding * 2);
      var viewportHPadded = (viewportHRaw - module.zoomPadding * 2);

      var slidesAspectRatio = module.width / module.height;
      var viewportAspectRatio = viewportWPadded / viewportHPadded;

      preferredStyleMethod(viewportWPadded, viewportHPadded, slidesAspectRatio, viewportAspectRatio);
    };
  };

  module.bindResizeZoom = function() {
    $(window).on('resize orientationChanged', module.resizeZoom);
  };

  return {
    tools: ['$slidesContainer', 'events'],
    entry: function(tools) {
      t = tools;
      t.events.on('init', function() {
        t.$slidesContainer.css({width: module.width + 'px', height: module.height + 'px'});
      });

      module.resizeZoom = module.resizeZoomFactory();
      module.resizeZoom();
      module.bindResizeZoom();
    },
  };
});

// non zooming fluid viewport
storyteller.define('viewport-fluid', function() {
  var self = this;
  var t;

  self.defaultOptions = function() {
    return {
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
    }
  };
  self.options = self.defaultOptions();

  // store the options that will be summed and set as options
  self.registeredOptions = {};

  self.calcOptions = function() {
    var newOptions = self.defaultOptions();
    for (optionName in self.registeredOptions) {
      var registeredOption = self.registeredOptions[optionName];
      self.addOptionValue(newOptions, registeredOption, 'paddingTop');
      self.addOptionValue(newOptions, registeredOption, 'paddingRight');
      self.addOptionValue(newOptions, registeredOption, 'paddingBottom');
      self.addOptionValue(newOptions, registeredOption, 'paddingLeft');
    }
    self.options = newOptions;
  };

  // handles anything and tries to add numbers
  self.addOptionValue = function(receiver, registered, key) {
    var newValue = registered[key];
    if (!isNaN(newValue) &&
        typeof receiver[key] !== 'undefined' &&
        typeof newValue !== 'undefined') {
      receiver[key] = receiver[key] + parseFloat(newValue, 10);
    }
  };

  self.renderOptions = function() {
    t.$slidesContainer.css({
      'top': self.options.paddingTop + 'px',
      'right': self.options.paddingRight + 'px',
      'bottom': self.options.paddingBottom + 'px',
      'left': self.options.paddingLeft + 'px',
    });
  };

  // TODO: Events should be multiple arguments, not a map of them
  self.handleRegisterOptions = function(e, registration) {
    self.registeredOptions[registration.caller] = registration.options;
    self.calcOptions();
    self.renderOptions();
  };

  return {
    tools: ['$slidesContainer', 'events'],
    entry: function(tools) {
      t = tools;

      self.calcOptions();
      self.renderOptions();

      t.events.on('viewport:register-options', self.handleRegisterOptions);
      // TODO: deregister/unregister options
    }
  }
});

// Single page advancement swipe
storyteller.define('control-simpleSwipe', function() {
  return {
    tools: ['events', '$slidesContainer'],
    entry: function(tools) {
      var t = tools;
      if (typeof $.fn.swipe === 'undefined') { // TODO: dependency injection (jspm?)
        console.error("touchswipe plugin missing")
        return;
      }

      t.$slidesContainer.swipe({
        swipe: function(event, direction, distance, duration, fingerCount) {
          if (direction === "right") {
            t.events.trigger('control:prev');
          } else if (direction === "left") {
            t.events.trigger('control:next');
          }
        }.bind(t.this)
      });
    },
  };
});

// Left right keyboard arrow key navigation
storyteller.define('control-keyboardNavigation', function() {
  return {
    tools: ['events'],
    entry: function(t) {
      $(document).keydown(function(e) { // TODO: listen only when the key is for this story
        switch(e.which) {
          case 32: // spacebar
          t.events.trigger('control:next');
          break;

          case 37: // left
          t.events.trigger('control:prev');
          break;

          case 39: // right
          t.events.trigger('control:next');
          break;

          default: return; // exit this handler for other keys
        }
        e.preventDefault(); // prevent the default action (scroll / move caret)
      });
    },
  };
});
