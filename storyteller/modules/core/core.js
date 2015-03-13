stories.define('storyline-linear', function() {
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
      t.events.on('control:advance', function(e, amount) {
        module.toSlide(module.currentSlideIndex + amount);
      });
    }
  }
});

stories.define('transition-fade', function() {
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

// left right navigation buttons
stories.define('control-navButtons', function() {
  return {
    tools: ['uiLayer', 'events'],
    entry: function(t) {
      var navPrev = $('<div class="nav-prev"></div>').prependTo(t.uiLayer);
      var navNext = $('<div class="nav-next"></div>').prependTo(t.uiLayer);

      navPrev.click(function() {
        t.events.trigger('control:advance', -1);
      });
      navNext.click(function() {
        t.events.trigger('control:advance', 1);
      });

      t.events.on("storyline:change", function(e, change) {
        if (change.toIndex === 0) {
          t.uiLayer.addClass('first-slide');
        } else if (change.toIndex === change.totalSlides - 1) {
          t.uiLayer.addClass('last-slide');
        } else {
          t.uiLayer.removeClass('first-slide');
          t.uiLayer.removeClass('last-slide');
        }
      });
    },
  };
});

// Background based on the current slide
stories.define('display-background-slide', function() {
  var module = this;
  var t;
  module.updateBackground = function(e, change) {
    t.uiLayer.attr({'template': change.$targetSlide.attr('template')});
  };

  return {
    tools: ['events', 'uiLayer'],
    entry: function(tools) {
      t = tools;
      t.events.on("storyline:change", module.updateBackground);
    },
  };
});

// Bottom blue bar
stories.define('control-progressBar-thin', function() {
  var module = this;
  var t;
  module.calcProgressBar = function(e, change) {
    var percentage = (change.toIndex) / (change.totalSlides - 1) * 100;
    t.uiLayer.css('width', percentage + '%');
  };

  return {
    tools: ['uiLayer', 'events'],
    entry: function(tools) {
      t = tools;
      t.events.on("storyline:change", module.calcProgressBar);
    },
  };
});

// Zooming of the slideshow
stories.define('viewport-fixed', function() {
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
stories.define('control-simpleSwipe', function() {
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
            t.events.trigger('control:advance', -1);
          } else if (direction === "left") {
            t.events.trigger('control:advance', 1);
          }
        }.bind(t.this)
      });
    },
  };
});

// Left right keyboard arrow key navigation
stories.define('control-arrowKeyNavigation', function() {
  return {
    tools: ['events'],
    entry: function(t) {
      $(document).keydown(function(e) { // TODO: listen only when the key is for this story
        switch(e.which) {
          case 32: // spacebar
          t.events.trigger('control:advance', 1);
          break;

          case 37: // left
          t.events.trigger('control:advance', -1);
          break;

          case 39: // right
          t.events.trigger('control:advance', 1);
          break;

          default: return; // exit this handler for other keys
        }
        e.preventDefault(); // prevent the default action (scroll / move caret)
      });
    },
  };
});
