storyteller.define('storyline-linear', function() {
  var module = this;
  var t;

  module.currentSlideIndex = 0;
  module.totalSlides = 0;
  module.isIndexInBounds = function(targetSlideIndex) {
    // Check bounds
    if (targetSlideIndex < 0 || targetSlideIndex >= module.totalSlides) {
      t.log('target slide out of bounds');
      return false;
    } else {
      return true;
    }
  },

  // Attempts to go to a target slide. Handles edgecases
  module.toSlide = function(targetSlideIndex) {
    if (!module.isIndexInBounds(targetSlideIndex)) {
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
        module.toSlide(module.currentSlideIndex);
      });
      t.events.on('control:jump', function(e, jump) {
        module.toSlide(jump.index);
      });
      t.events.on('control:advance', function(e, advance) {
        module.toSlide(module.currentSlideIndex + advance.amount);
      });
      t.events.on('control:next', function() {
        module.toSlide(module.currentSlideIndex + 1);
      });
      t.events.on('control:prev', function() {
        module.toSlide(module.currentSlideIndex - 1);
      });
    }
  }
});

storyteller.define('transition-fade', function() {
  return {
    tools: ['events', '$slides'],
    entry: function(t) {
      t.events.on("storyline:change", function(e, change) {
        t.$slides.removeClass('visible'); // TODO: see if performance is an issue; if so, improve
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
  return {
    entry: function() {
    }
  }
});


// Modular ui bar for others to register on to
storyteller.define('control-dock', function() {
  var module = this;
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
    },
    calcProgressBar: function(e, change) {
      var percentage = (change.toIndex) / (change.totalSlides - 1) * 100;
      module.progressBar.$barMin.css('width', percentage + '%');
    },
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
storyteller.define('display-background-slide', function() {
  var module = this;
  var t;
  module.updateBackground = function(e, change) {
    t.$uiUnderlay.attr({'template': change.$targetSlide.attr('template')});
  };

  return {
    tools: ['events', '$uiUnderlay'],
    entry: function(tools) {
      t = tools;
      t.events.on("storyline:change", module.updateBackground);
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

// Zooming of the slideshow
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
    tools: ['$slidesContainer' ,'events'],
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
