storyteller.define('storyline-linear', function() {
  var module = this;
  var t;

  module.config = {
    nextSize: 1
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

storyteller.define('url-hash', function() {
  var self = this;
  var t;

  // TODO: configurable options
  self.options = {
    disableFirstSlide: true
  };

  self.firstTime = true;

  self.setHash = function(toSlideNum) {
    var hashIsNumeric = window.location.hash.replace('#','').match(/^[0-9]*$/) !== null;
    if (window.location.hash !== "" && !hashIsNumeric) {
      // Don't conflict with other possibly custom hash handling schemes
      return;
    }

    if (self.options.disableFirstSlide && toSlideNum == 1) {
      // remove the hash
      history.replaceState("", document.title, window.location.pathname + window.location.search + '');
      return;
    }

    // Add something to the history if this is the first one we are coming from
    // Prevents polluting of the history
    if (self.firstTime) {
      self.firstTime = false;
      window.location.hash = toSlideNum;
    } else {
      history.replaceState("", document.title, window.location.pathname + window.location.search + '#' + toSlideNum);
    }
  };

  self.hashHandler = function() {
    var checkHash = window.location.hash.replace('#','').match(/^[0-9]*$/);
    if (checkHash === null) {
      return;
    }

    if (checkHash.input.length === 0) {
      t.events.trigger('control:jump', {index: 0});
    } else {
      t.events.trigger('control:jump', {index: parseInt(checkHash.input, 10) - 1});
    }
  };

  return {
    tools: ['events'],
    entry: function(tools) {
      t = tools;
      $(window).on('hashchange', self.hashHandler);
      t.events.on('init', function() {
        self.hashHandler();

        t.events.on('storyline:change', function(e, change) {
          self.setHash(change.toIndex + 1);
        });

        // t.events.on('control:jump', function(e, ju))
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
    slideMarginTop: 8,
    slideMarginBottom: 0,
    // registeredPadding: { // TODO: ui padding registration tool
    //   'bottom': 16 //px
    // },
    virtualWidth: 720,
    virtualHeight: 1280,
    multiCardsThreshold: 2, // decimal amount of cards at which multiCards takes effect
    multiCardsMin: 3, // number of cards to letterbox to if reached the multiCardsThreshold
    defaultScalingMode: "box" // box or transform. can also be set using html scaling-mode="scale"
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

    // save options
    layout.verticalMargin = opts.slideMarginTop + opts.slideMarginBottom;
    layout.horizontalMargin = opts.slideMarginHorizontal;

    // calculate container size
    layout.viewportWidth = t.$viewport.width();
    layout.viewportHeight = t.$viewport.height(); // - self.options.registeredPadding.bottom;

    // calculate if we are bounded by container width or height
    // here, we take a guess that it is bounded by width
    var slideWidthGuess = layout.viewportWidth - 2 * opts.slideMarginHorizontal;
    var slideHeightGuess = slideWidthGuess / layout.aspectRatio;
    var slideOuterHeightGuess = slideHeightGuess + layout.verticalMargin;

    // if height is less than the viewport, then our guess was correct
    layout.boundByWidth = (slideOuterHeightGuess < layout.viewportHeight);

    // default value
    layout.letterBoxVertical = 0;

    // Calculate the sizes of each card and the number of cards
    if (layout.boundByWidth) {
      // slide dimensions
      layout.slideWidth = layout.viewportWidth - 2 * opts.slideMarginHorizontal;
      layout.slideHeight = layout.slideWidth / layout.aspectRatio;
      layout.scale = layout.slideWidth / opts.virtualWidth;

      // positioning
      layout.letterBoxVertical = (layout.viewportHeight - layout.slideHeight - opts.slideMarginTop - opts.slideMarginBottom)/2;

      // bounded by width automatically means only 1 card at a time
      layout.numCards = 1;
    } else {
      layout.slideHeight = layout.viewportHeight - layout.verticalMargin;
      layout.slideWidth = layout.slideHeight * layout.aspectRatio;
      layout.scale = layout.slideHeight / opts.virtualHeight; // less precision loss

      // solve for n: layout.viewportWidth = n*layout.slideWidth + (n+1) * self.options.slideMarginHorizontal
      decimalNumCards =
        (layout.viewportWidth - opts.slideMarginHorizontal)
        /
        (layout.slideWidth + opts.slideMarginHorizontal);

      if (decimalNumCards > opts.multiCardsThreshold && decimalNumCards < opts.multiCardsMin) {
        layout.numCards = opts.multiCardsMin;
        // calculate the letterbox size required to fit the minimum cards
        // constraint:
        //   layout.viewportWidth = opts.multiCardsMin*newSlideWidth + (opts.minMultiCards+1) * self.options.slideMarginHorizontal
        // solve for newSlideWidth:
        //   v = m*n + (m+1)*s
        //   n = (v-s)/m - s
        var newSlideWidth = (layout.viewportWidth - self.options.slideMarginHorizontal)/opts.multiCardsMin - self.options.slideMarginHorizontal

        layout.slideWidth = newSlideWidth;
        layout.slideHeight = layout.slideWidth / layout.aspectRatio;
        layout.scale = layout.slideWidth / opts.virtualWidth;

        layout.letterBoxVertical = (layout.viewportHeight - layout.slideHeight) / 2;
      } else {
        layout.numCards = Math.floor(decimalNumCards);
      }
    }

    layout.slideScalingMode = [];
    t.$slides.forEach(function($slide, k) {
      var customScalingMode = $slide.attr('scaling-mode');
      if (customScalingMode === undefined) {
        layout.slideScalingMode[k] = self.options.defaultScalingMode;
      } else {
        layout.slideScalingMode[k] = customScalingMode;
      }
    });

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
      (layout.numCards-1) * layout.horizontalMargin; // inner slide margins

    layout.contentOuterWidth = layout.contentInnerWidth + 2 * layout.horizontalMargin;

    // slideXOffset is the horizontal distance between the viewport and the left slide on the screen
    if (layout.numCards == 1) {
      var slideXOffset = (layout.viewportWidth - layout.contentInnerWidth) / 2;
    } else {
      // First slide starts on the left
      var slideXOffset = layout.horizontalMargin;
    }

    // calculate offsets relevant to individual slides
    for (var i = 0; i < self.storyline.totalSlides; i++) {
      var thisSlideOffset = (i) * (layout.slideWidth + layout.horizontalMargin);

      self.slidePositions[i] = {
        x: slideXOffset + thisSlideOffset,
        y: opts.slideMarginTop + layout.letterBoxVertical
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

      if (self.slideLayout.slideScalingMode[i] === 'box') {
        t.$slides[i].css({
          'top': curPosition.y + 'px',
          'left': curPosition.x + 'px',
          'width': self.slideLayout.slideWidth + 'px',
          'height': self.slideLayout.slideHeight + 'px',
          '-webkit-transform': '',
                  'transform': ''
        });
      } else if (self.slideLayout.slideScalingMode[i] === 'transform') {
        var transformProp = 'scale(' + self.slideLayout.scale + ') translateZ(0)';
        t.$slides[i].css({
          'top': curPosition.y + 'px',
          'left': curPosition.x + 'px',
          'width': self.options.virtualWidth + 'px',
          'height': self.options.virtualHeight + 'px',
          '-webkit-transform': transformProp,
                  'transform': transformProp
        });
      }

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

    self.publishSlideInfo();
  };

  self.rePosition = function() {
    self.calcContainerOffset();
    self.applyOffsetTransform();

    self.publishSlideInfo();
  };

  // publishes and event containing useful info (for analytics)
  self.publishSlideInfo = function() {
    // contains slide numbers (not indexes) that are currently shown
    visible = [];

    // add all visible slides to the visible array
    var firstSlide = self.storyline.curSlideIndex + 1;
    var lastSlide = Math.min(firstSlide + self.slideLayout.numCards - 1, self.storyline.totalSlides);
    var numVisible = lastSlide - firstSlide + 1;
    for (var i = 0; i < numVisible; i++) {
      visible[i] = firstSlide + i;
    }

    t.events.trigger('slides:info', {
      visible: visible
    });
  }

  return {
    tools: ['$viewport', '$slides', '$slidesContainer', 'events'],
    entry: function(tools) {
      t = tools;
      t.events.trigger('viewport:register-options', {
        'caller': 'slide-cards', // TODO: personalized events to automatically include caller
        'options': {
          'paddingBottom': 32,
        }
      });

      // TODO: better story around communiating with storyline
      self.storyline.totalSlides = t.$slides.length;

      t.events.on('storyline:change', function(e, change) {
        self.storyline.curSlideIndex = change.toIndex;
        self.storyline.totalSlides = change.totalSlides;

        self.rePosition();
      });
      t.events.on('init', function() {
        self.reLayout();
        t.$viewport.addClass('ready');

        t.events.on('viewport:resize', function() {
          self.reLayout();
        });
      });
    }
  }
});

// Draggable card navigation
// TODO: Make this more generic
storyteller.define('cards-touch', function() {
  var self = this;
  var t;

  // TODO: configurable options
  var options = {
    momentumMultiplier: 750,
    travelThreshold: 0.5, // requires that a use go past the halfway point to snap to the next one
  }

  self.slideCardsLayout = {};
  self.storyLineState = {};

  if (typeof Hammer === "undefined") {
    console.error("HammerJS is not defined");
    return {};
  }

  // TODO: edgecase: user goes to a next slide and starts dragging again before old transition finishes
  self.handleTouches = function() {
    var touch = new Hammer(t.$viewport[0]);

    // Use DIRECTION_ALL to prevent vertical scrolling
    touch.get('pan').set({ direction: Hammer.DIRECTION_ALL });

    var createTransformCss = function(x) {
      var transformProp = 'translateX(' + x + 'px' + ') translateZ(0)';
      return {
        '-webkit-transform': transformProp,
                'transform': transformProp
      };
    };

    var panning = function(e) {
      t.$slidesContainer.addClass('notransition');
      t.$slidesContainer.css(createTransformCss(self.slideCardsOffset + e.deltaX));
    };

    // TODO: Not always called from a Hammer callback. Also trigger when
    // non-touch events interfere and finish the panning.
    var panFinish = function(e) {
      var targetIndex;

      // momentumX is the final instantaneous velocity (px/ms) multiplied
      var momentumX = (-1) * e.velocityX * options.momentumMultiplier;

      // travelX is the amount moved with a bonus added coming from momentumX
      // This enables slow flicks when the user is already close to the threshold
      var travelX = e.deltaX + momentumX;

      // negative deltaX means swiping towards the left and advancing forward (in LTR)
      var swipedLeft = travelX > self.slideCardsLayout.contentOuterWidth * 0.5;
      var swipedRight = travelX < self.slideCardsLayout.contentOuterWidth * -0.5;

      if (swipedLeft) {
        targetIndex = self.storylineState.currentIndex - self.slideCardsLayout.numCards;
      } else if (swipedRight) {
        targetIndex = self.storylineState.currentIndex + self.slideCardsLayout.numCards;
      } else {
        targetIndex = self.storylineState.currentIndex;
      }

      t.$slidesContainer.removeClass('notransition');

      if (targetIndex < 0) {
        targetIndex = 0;
      }
      var targetPastLast = targetIndex >= self.storylineState.totalSlides;
      var targetIndexIsSame = targetIndex === self.storylineState.currentIndex;
      if (targetPastLast || targetIndexIsSame) {
        revertPan();
      } else {
        t.events.trigger('control:jump', {
          index: targetIndex
        });
      }
    };

    var revertPan = function() {
      t.$slidesContainer.css(createTransformCss(self.slideCardsOffset));
    };

    touch.on("panstart pan panend", function(e) {
      if (e.type === "panstart") {
        panning(e);
      } else if (e.type === "panend") {
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
        self.slideCardsOffset = reOffset;
      });
      t.events.on("storyline:change", function(e, change) {
        self.storylineState = {
          currentIndex: change.toIndex,
          totalSlides: change.totalSlides
        };
      });

      self.handleTouches();
    }
  }
});

// Modular ui bar for others to register on to
storyteller.define('control-dock', function() {
  var self = this;
  var t;

  // A submodule
  self.progressBar = {
    // TODO: configurable options
    options: {
      "theme": "tube", // tube or default (or custom name)
      "classes": "", // used for theming
    },
    container: {},
    barMin: {},
    barMax: {},
    init: function() {
      self.progressBar.$module = $('<div class="control-dock-button-progressBar"></div>').prependTo(t.$uiOverlay);
      self.progressBar.$barContainer = $('<div class="bar-container"></div>').prependTo(self.progressBar.$module);
      self.progressBar.$module.addClass('theme-' + self.progressBar.options.theme + ' ' + self.progressBar.options.classes);
      self.progressBar.$barMin = $('<div class="bar-min"></div>').prependTo(self.progressBar.$barContainer);
      self.progressBar.$barMax = $('<div class="bar-max"></div>').prependTo(self.progressBar.$barContainer);
      t.events.on('storyline:change', self.progressBar.calcProgressBar);
      self.progressBar.$barContainer.on('click', self.progressBar.handleProgressBar);
    },
    calcProgressBar: function(e, change) {
      var percentage = (change.toIndex) / (change.totalSlides - 1) * 100;
      self.progressBar.$barMin.css('width', percentage + '%');
    },
    // Handle event for progress bar clicks
    handleProgressBar: function(e) {
      var x  = (e.offsetX || e.clientX - $(e.target).offset().left); // firefox compatibility
      var targetPercent = x/self.progressBar.$module.width() * 100;
      t.events.trigger('control:jump', {percent: targetPercent});
    }
  };

  // A submodule
  self.gridView = {
    init: function() {
      self.$gridViewButton = $('<div class="control-dock-button-gridView control-dock__button"></div>').appendTo(t.$uiOverlay);
      self.$gridViewButton.on('click', function() {
        t.events.trigger('gridView:enter');
      });
    }
  };

  // A submodule
  self.fullScreen = {
    init: function() {
      self.$fullScreenButton = $('<div class="control-dock-button-fullScreen control-dock__button"></div>').appendTo(t.$uiOverlay);
      self.$fullScreenButton.on('click', function() {
        t.events.trigger('fullScreen:enter');
      })
    }
  };

  // TODO: better name for elementReceivier
  self.elementReceiverCreator = function(name) {
    return function(element) {
      var $element = $(element).addClass('control-dock-button-' + name + ' control-dock__button');
      $element.appendTo(t.$uiOverlay);
    };
  };

  return {
    tools: ['$uiOverlay', 'events'],
    entry: function(tools) {
      t = tools;

      self.progressBar.init();
      t.events.on('control-dock:register', function(e, register) {
        register.factory(self.elementReceiverCreator(register.name));
      });
      // TODO: Figure out better way to order things
      t.events.on('init', function() {
        // self.gridView.init();
        // self.fullScreen.init();
      });
    }
  }
});

storyteller.define('share', function() {
  var self = this;
  var t;

  self.options = {};

  // UI module to be registered with other ui managers
  self.uiModuleFactory = function(elementReceiver) {
    self.$uiModule = $('<div></div>');
    elementReceiver(self.$uiModule);
    self.$uiModule.on('click', function() {
      t.events.trigger('share:enter');
    });
  };

  return {
    tools: ['$uiOverlay', 'events', 'options'],
    entry: function(tools) {
      t = tools;
      $.extend(self.options, t.options.share);

      // TODO: a way for some things to always be at the top (uiLayer vs uiOverlay?)
      t.$uiOverlay.css('z-index', 5);
      t.$uiOverlay.append('<div class="share-exitLayer"></div>')
      t.$uiOverlay.find('.share-exitLayer').on('click', function() {
        t.events.trigger('share:exit');
      });

      // TODO: configurable shareContent
      var $shareContent = $('<div class="share-content"></div>').prependTo(t.$uiOverlay);
      self.options.contentWidgets.forEach(function(widget) {
        switch (widget.type) {
        case 'title':
          $shareContent.append('<div class="share-content-title">' + widget.text + '</div>');
          break;
        case 'label':
          $shareContent.append('<div class="share-content-label">' + widget.text + '</div>');
          break;
        case 'link':
          $shareContent.append('<input type="text" value="' + encodeURI(self.options.linkUrl) + '" />');
          break;
        case 'embed':
          $shareContent.append('<textarea spellcheck="false">' +
            '<iframe width="' + self.options.embedWidth + '" height="' + self.options.embedHeight + '"' +
            ' src="'+ encodeURI(self.options.embedUrl) + '" frameborder="0" allowfullscreen></iframe>' +
            '</textarea>');
          break;
        }
      });

      // TODO: module registration ordering (assistance from storyteller tools?)
      t.events.trigger('control-dock:register', {
        name: 'share',
        factory: self.uiModuleFactory
      });

      t.events.on('share:enter', function() {
        self.$uiModule.addClass('is-active');
        t.$uiOverlay.addClass('is-active');
      });

      t.events.on('share:exit', function() {
        self.$uiModule.removeClass('is-active');
        t.$uiOverlay.removeClass('is-active');
      });
    }
  };
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

  // watchViewport watches only the $viewport as opposed to using $(window).resize()
  // which may not be accurate
  self.startWatchingViewport = function() {
    var prevViewportSize = getViewportSize();
    setInterval(changeDetector, 200);

    $(window).on('resize orientationchange', function() {
      changeDetector();
    });

    function getViewportSize() {
      return {
        width: t.$viewport.outerWidth(),
        height: t.$viewport.outerHeight()
      };
    }
    function changeDetector() {
      var newViewportSize = getViewportSize();
      if (prevViewportSize.width !== newViewportSize.width ||
          prevViewportSize.height !== newViewportSize.height) {
        prevViewportSize = newViewportSize;
        t.events.trigger('viewport:resize');
      }
    }
  };

  return {
    tools: ['$viewport', 'events'],
    entry: function(tools) {
      t = tools;

      self.calcOptions();
      self.renderOptions();

      t.events.on('viewport:register-options', self.handleRegisterOptions);
      // TODO: deregister/unregister options

      t.events.on('init', function() {
        self.startWatchingViewport();
      });
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

// bind to items on slides to click
storyteller.define('clickTrigger', function() {
  var self = this;
  var t;
  return {
    tools: ['events', 'slides'],
    entry: function(tools) {
      t = tools;
      t.events.on('init', function() {
        t.slides.find('[click-trigger]').each(function(k, target) {
          var $target = $(target);
          $target.css('cursor', 'pointer');
          $target.on('click', function() {
            t.events.trigger($target.attr('click-trigger'));
          })
        });
      });
    }
  }
});

// to make the loading experience better
storyteller.define('loadingScreen', function() {
  var self = this;
  var t;

  self.options = {
    loadingText: '',
    loadingNumber: false
  };
  return {
    tools: ['events', '$uiOverlay', 'slides', 'options'],
    entry: function(tools) {
      t = tools;
      $.extend(self.options, t.options.loadingScreen);

      var $preloadImages = t.slides.find('img[st-src]');
      var totalImages = $preloadImages.length;
      var loadedImages = 0;

      var $loadingContainer = $('<div class="loadingScreen-container"></div>').prependTo(t.$uiOverlay);
      var $loadingText = $('<p class="loadingScreen-loadingText"></p>').prependTo($loadingContainer);
      $loadingText.text(self.options.loadingText);
      var $loadingBar = $('<div class="loadingScreen-loadingBar"></div>').appendTo($loadingContainer);
      var $loadingProgress = $('<div class="loadingScreen-loadingProgress"></div>').appendTo($loadingBar);
      var $loadingNumber = $('<span class="loadingScreen-loadingNumber"></span>');
      if (self.options.loadingNumber) {
        $loadingNumber.appendTo($loadingProgress)
      }

      var updateProgress = function() {
        var percentage = (loadedImages/totalImages)*100;
        $loadingProgress.css('width', percentage + '%');
        $loadingNumber.text(Math.round(percentage) + '%');
      };
      var loadFinished = function() {
        t.$uiOverlay.addClass('is-loaded');
        t.events.trigger('loading:finished');
      };

      t.events.on('init', function() {
        $preloadImages.each(function(k, preloadImage) {
          var $preloadImage = $(preloadImage);
          var imgUrl = $preloadImage.attr('st-src');
          $preloadImage.attr('src', imgUrl);
        });
        $preloadImages.load(function() {
          loadedImages += 1;
          updateProgress();
          if (loadedImages === totalImages) {
            loadFinished();
          }
        });
        setTimeout(function() {
          loadFinished();
        }, 10000);
      });
    }
  }
});

// integration with 3rd party services such as google analytics or segment
storyteller.define('analytics', function() {
  var self = this;
  var t;


  self.options = {
  };
  self.eventPrefix = '';

  self.trackEnd = function() {
    var totalSlides;
    var ended = false; // only end once
    t.events.on('storyline:change', function(e, change) {
      totalSlides = change.totalSlides;
    });
    t.events.on('slides:info', function(e, info) {
      if (!ended) {
        info.visible.forEach(function(slideNum) {
          if (slideNum == totalSlides) {
            t.events.trigger('analytics:event', {
              name: self.eventPrefix + self.options.eventEndFragment
            });
            ended = true;
          }
        });
      }
    });
  };
  self.trackLoad = function() {
    t.events.on('init', function() {
      var event = {
        name: self.eventPrefix + self.options.eventLoadFragment
      };
      t.events.trigger('analytics:event', event);
    });
  };
  self.trackPage = function() {
    t.events.on('slides:info', function(e, info) {
      info.visible.forEach(function(slideNum) {
        var event = {
          name: self.eventPrefix + self.options.eventPageFragment + slideNum
        };
        t.events.trigger('analytics:event', event);
      });
    });
  };

  self.trackers = {
    'page': self.trackPage,
    'load': self.trackLoad,
    'end': self.trackEnd
  };

  return {
    tools: ['events', 'log', 'options'],
    entry: function(tools) {
      t = tools;
      $.extend(self.options, t.options.analytics);

      // if (typeof self.options.disableIfWindowVarSet !== 'undefined' &&
      //   self.options.disableIfWindowVarSet in window) {
      //   t.log('Analytics disabled');
      //   return;
      // } else if (typeof self.options.disableIfElementExists !== 'undefined' &&
      //   $(self.options.disableIfElementExists).length > 0) {
      //   t.log('Analytics disabled');
      //   return;
      // } else {
      //   t.log('Analytics enabled');
        t.events.on('init', function() {
          t.events.trigger('analytics:enabled');
        });
      // }

      // save event prefix
      if (typeof self.options.eventPrefixFragment !== 'undefined') {
        self.eventPrefix = self.options.eventPrefixFragment;
      };

      // initialize trackers from list in config
      if (self.options.hasOwnProperty('trackers') && Array.isArray(self.options.trackers)) {
        self.options.trackers.forEach(function(tracker) {
          if (tracker in self.trackers) {
            self.trackers[tracker]();
          }
        });
      };
    },
  };
});
storyteller.define('analytics-segment', function() {
  var self = this;
  var t;

  self.options = {
  };

  self.eventQueue = [];
  self.eventQueueFulfilled = false;
  self.windowFocused = false;
  self.initHappened = false;
  self.analyticsEnabled = false;
  self.loadingFinished = false;

  self.updateEventQueue = function() {
    // TODO: code cleanup
    if (self.windowFocused
       && self.initHappened
       && self.analyticsEnabled
       && self.loadingFinished
       && !self.eventQueueFulfilled) {
      self.eventQueueFulfilled = true;
      self.initSegment();
      for (var i = 0; i < self.eventQueue.length; i++) {
        t.log('analytics: ' + self.eventQueue[i])
        analytics.track(self.eventQueue[i], self.properties);
      }
    }
  };

  self.initSegment = function() {
    // taken from segment
    !function(){var analytics=window.analytics=window.analytics||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","group","track","ready","alias","page","once","off","on"];analytics.factory=function(t){return function(){var e=Array.prototype.slice.call(arguments);e.unshift(t);analytics.push(e);return analytics}};for(var t=0;t<analytics.methods.length;t++){var e=analytics.methods[t];analytics[e]=analytics.factory(e)}analytics.load=function(t){var e=document.createElement("script");e.type="text/javascript";e.async=!0;e.src=("https:"===document.location.protocol?"https://":"http://")+"cdn.segment.com/analytics.js/v1/"+t+"/analytics.min.js";var n=document.getElementsByTagName("script")[0];n.parentNode.insertBefore(e,n)};analytics.SNIPPET_VERSION="3.0.1";
    analytics.load(self.options.writeKey);
    analytics.page()
    }}();
  };

  return {
    tools: ['events', 'log', 'options'],
    entry: function(tools) {
      t = tools;

      $.extend(self.options, t.options.analyticsSegment);
      self.properties = {};
      // TODO: more configurable properties
      if (self.options.hasOwnProperty('category')) {
        self.properties.category = self.options.category;
      }

      t.events.on('analytics:event', function(e, event) {
        // TODO: Make this nicer
        if (!self.eventQueueFulfilled) {
          self.eventQueue.push(event.name);
          self.updateEventQueue();
        } else {
          analytics.track(event.name, self.properties);
        }
      });

      // TODO: remove when done
      setInterval(function() {
        if (document.hasFocus()) {
          self.windowFocused = true;
          self.updateEventQueue();
        }
      }, 200);
      t.events.on('init', function() {
        self.initHappened = true;
        self.updateEventQueue();
      });
      t.events.on('analytics:enabled', function() {
        self.analyticsEnabled = true;
        self.updateEventQueue();
      });
      t.events.on('loading:finished', function() {
        // TODO: disableable option
        self.loadingFinished = true;
        self.updateEventQueue();
      });
    },
  };
});
