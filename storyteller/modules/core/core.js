storyteller.define('storyline-linear', function() {
  var module = this;
  var t;

  module.config = {
    nextSize: 0
  };

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

  module.rectifyBounds = function(index) {
    if (index < 0) {
      return 0;
    } else if (index >= module.totalSlides) {
      return module.totalSlides - 1;
    } else {
      return index;
    }
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
          index: module.rectifyBounds(module.currentSlideIndex + module.config.nextSize)
        });
      });
      t.events.on('control:prev', function() {
        module.toSlide({
          index: module.rectifyBounds(module.currentSlideIndex - module.config.nextSize)
        });
      });
      t.events.on('storyline:setConfig', function(e, setConfig) {
        if ($.isNumeric(setConfig.nextSize)) {
          module.config.nextSize = parseInt(setConfig.nextSize, 10);
        }
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

  // A number specifying how much to translate the slides container to account
  // for the current slide
  self.containerOffet;

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
    layout.viewportWidth = t.$viewport.width();
    layout.viewportHeight = t.$viewport.height(); // - self.options.registeredPadding.bottom;

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

    t.events.trigger('storyline:setConfig', {nextSize: layout.numCards});

    self.calcSlidePositions();
  }

  /*
    calcSlidePositions calculates the x and y position of each card based on the
    layout as calculated by calcSlideLayout().
  */
  self.calcSlidePositions = function() {
    self.slidePositions = []; // reset the slide positions
    // alias to reduce code verbosity
    var layout = self.slideLayout;
    var opts = self.options;

    // calculating contentInnerWidth and slideXOffset belongs in calcContainerOffset
    // but is here for optimization reasons

    // calculate offsets relevant to all slides
    // contentInnerWidth is the total size of all the slides on screen and margins between these slides
    layout.contentInnerWidth =
      layout.numCards * layout.slideWidth + // slide sizes
      (layout.numCards-1) * opts.slideMarginHorizontal; // inner slide margins

    layout.contentOuterWidth = layout.contentInnerWidth + 2 * opts.slideMarginHorizontal;

    // slideXOffset is the horizontal distance between the viewport and the left slide on the screen
    if (layout.numCards == 1) {
      var slideXOffset = (layout.viewportWidth - layout.contentInnerWidth) / 2;
    } else {
      // First slide starts on the left
      var slideXOffset = opts.slideMarginHorizontal;
    }

    // calculate offsets relevant to individual slides
    for (var i = 0; i < self.storyline.totalSlides; i++) {
      var thisSlideOffset = (i) * (layout.slideWidth + opts.slideMarginHorizontal);

      self.slidePositions[i] = {
        x: slideXOffset + thisSlideOffset,
        y: (layout.viewportHeight - layout.slideHeight) / 2
      };
    }

    // TODO: this is hacky. make a defined public interface
    t.events.trigger('slide-cards:reLayout', layout);

    self.calcContainerOffset();
  };

  /*
    calcSlideOffsets moves the slidesContainer to account for the current slide.
  */
  self.calcContainerOffset = function() {
    var layout = self.slideLayout;
    var opts = self.options;

    var navigatedSlideOffset = (self.storyline.curSlideIndex) * (layout.slideWidth + opts.slideMarginHorizontal);
    self.containerOffset = (-1) * navigatedSlideOffset;

    t.events.trigger('slide-cards:reOffset', self.containerOffset);
  }

  // Aassumes that the array is the same length as the number of slides
  // Applies the calculations for individual slides
  self.applySlideTransforms = function() {
    // TODO: optimize performance here
    for (var i = 0; i < self.storyline.totalSlides; i++) {
      var curPosition = self.slidePositions[i];

      // Chrome renders things blurry if it is translated by half a pixel.
      // Round so that things will render more clearly
      curPosition.x = Math.round(curPosition.x);
      curPosition.y = Math.round(curPosition.y);

      var transformProp = 'scale(' + self.slideLayout.scale + ') translateZ(0)';
      t.$slides[i].css({
        'top': curPosition.y + 'px',
        'left': curPosition.x + 'px',
        '-webkit-transform': transformProp,
                'transform': transformProp
      });
    }
  }

  self.applyOffsetTransform = function() {
    var transformProp = 'translateX(' + self.containerOffset + 'px' + ') translateZ(0)';
    t.$slidesContainer.css({
      '-webkit-transform': transformProp,
              'transform': transformProp
    });
  };

  // reLayout calculates the sizing, position, and math. To be run on load and
  // when viewport size changes. Will also do all the steps in self.rePosition
  self.reLayout = function() {
    self.calcSlideLayout();
    self.applySlideTransforms();
    self.applyOffsetTransform();
  };

  self.rePosition = function() {
    self.calcContainerOffset();
    self.applyOffsetTransform();
  };

  // watchViewport watches only the $viewport as opposed to using $(window).resize()
  // which may not be accurate
  self.watchViewport = function() {
    var callbacks = [];
    var started = false;
    var prevViewportSize;


    var addCallback = function(callback) {
      callbacks.push(callback);
      startWatcher();
    };
    var startWatcher = function() {
      if (started) {
        return;
      }
      started = true;

      prevViewportSize = getViewportSize();
      setInterval(changeDetector, 200);
    };
    var getViewportSize = function() {
      return {
        width: t.$viewport.outerWidth(),
        height: t.$viewport.outerHeight()
      };
    }
    var changeDetector = function() {
      var newViewportSize = getViewportSize();
      if (prevViewportSize.width !== newViewportSize.width ||
          prevViewportSize.height !== newViewportSize.height) {
        prevViewportSize = newViewportSize;
        for (var i = 0; i < callbacks.length; i++) {
          callbacks[i].call();
        }
      }
    }

    return addCallback;
  }();

  return {
    tools: ['$viewport', '$slides', '$slidesContainer', 'events'],
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

      t.events.on('init', function() {
        t.events.on('storyline:change', function(e, change) {
          self.storyline.curSlideIndex = change.toIndex;
          self.storyline.totalSlides = change.totalSlides;

          self.rePosition();
        });
        self.reLayout();
        t.$viewport.addClass('ready');

        self.watchViewport(function() {
          self.reLayout();
        })
      });
    }
  }
});

// Draggable card navigation
// TODO: Make this more generic
storyteller.define('cards-touch', function() {
  var self = this;
  var t;

  self.slideCardsLayout = {};
  self.storyLineState = {};

  if (typeof Hammer === "undefined") {
    console.error("HammerJS is not defined");
    return {};
  }

  self.handleTouches = function() {
    var touch = new Hammer(t.$viewport[0]);
    var state = {
      startingLeft: 0, // the translateX value before any panning started
      latestDeltaX: 0, // Since there may be multiple panstarts, keep track of previous session
      panStarted: false
    };

    // Use DIRECTION_ALL to prevent vertical scrolling
    touch.get('pan').set({ direction: Hammer.DIRECTION_ALL });
    touch.add(new Hammer.Pan({
      event: 'doublepan',
      pointers: 2,
      direction: Hammer.DIRECTION_HORIZONTAL,
      threshold: 0
    }));

    var createTransformCss = function(x) {
      var transformProp = 'translateX(' + x + 'px' + ') translateZ(0)';
      return {
        '-webkit-transform': transformProp,
                'transform': transformProp
      };
    };

    var panStart = function(e) {
      if (!state.panStarted) {
        state.startingLeft = self.slideCardsOffset;
        state.panStarted = true;
      }
    };

    var panning = function(e) {
      // console.log(e.deltaX)
      // state.latestDeltaX = e.deltaX;
      t.$slidesContainer.addClass('notransition');
      t.$slidesContainer.css(createTransformCss(state.startingLeft + e.deltaX));
      t.$slidesContainer[0].offsetHeight; // reflow CSS
      t.$slidesContainer.removeClass('notransition');
    };

    // Not always called from a Hammer callback. Also triggered when non-touch
    // events interfere and finish the panning.
    var panFinish = function(e) {
      // console.log(currentDeltaX);
      // state.startingLeft = 0;
      // console.log(e.deltaX);
      // console.log(self.slideCardsLayout.contentOuterWidth);
      var targetIndex;
      state.panStarted = false;
      state.latestDeltaX = 0;

      if (e.deltaX > self.slideCardsLayout.contentOuterWidth * 0.5) {
        // positive deltaX means swiping towards the left and advancing forward (in LTR)
        targetIndex = self.storylineState.currentIndex - self.slideCardsLayout.numCards;
      } else if (e.deltaX < self.slideCardsLayout.contentOuterWidth * -0.5) {
        // negative deltaX means swiping towards the right and advancing backwards (in LTR)
        targetIndex = self.storylineState.currentIndex + self.slideCardsLayout.numCards;
      } else {
        revertPan();
        return;
      }

      var targetIndexOutOfBounds = targetIndex < 0 || targetIndex >= self.storylineState.totalSlides;
      var targetIndexIsSame = targetIndex === self.storylineState.currentIndex;
      if (targetIndexOutOfBounds || targetIndexIsSame) {
        revertPan();
      } else {
        t.events.trigger('control:jump', {
          index: targetIndex
        });
      }
    };

    var revertPan = function() {
      t.$slidesContainer.css(createTransformCss(state.startingLeft));
    };

    touch.on("panstart pan panend", function(e) {
      console.log(e.type)
      if (e.type === "panstart") {
        panStart(e);
        panning(e);
      } else if (e.type === "panend") {
        console.log('\n\n');
        panFinish(e);
      } else {
        panning(e);
      }
    });
  }

  return {
    tools: ["$uiOverlay", "events", "$viewport", "$slidesContainer"],
    entry: function(tools) {
      t = tools;

      t.events.on('slide-cards:reLayout', function(e, reLayout) {
        self.slideCardsLayout = reLayout;
      });
      t.events.on('slide-cards:reOffset', function(e, reOffset) {
        console.log(reOffset);
        self.slideCardsOffset = reOffset;
      });

      t.events.on("storyline:change", function(e, change) {
        console.log(change);
        self.storylineState = {
          currentIndex: change.toIndex,
          totalSlides: change.totalSldies
        };
      });

      self.handleTouches();
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
        t.$viewport.css({
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
        t.$viewport.css({
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
    tools: ['$viewport', 'events'],
    entry: function(tools) {
      t = tools;
      t.events.on('init', function() {
        t.$viewport.css({width: module.width + 'px', height: module.height + 'px'});
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
    t.$viewport.css({
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
    tools: ['$viewport', 'events'],
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
    tools: ['events', '$viewport'],
    entry: function(tools) {
      var t = tools;
      if (typeof $.fn.swipe === 'undefined') { // TODO: dependency injection (jspm?)
        console.error("touchswipe plugin missing")
        return;
      }

      t.$viewport.swipe({
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
