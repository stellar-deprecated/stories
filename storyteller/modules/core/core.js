stories.define('navButtons', function() {
  return {
    tools: ['this', 'uiLayer'],
    entry: function(t) {
      var navPrev = $('<div class="nav-prev"></div>').prependTo(t.uiLayer);
      var navNext = $('<div class="nav-next"></div>').prependTo(t.uiLayer);

      navPrev.click(t.this.prevSlide.bind(t.this));
      navNext.click(t.this.nextSlide.bind(t.this));
    },
  };
});

// Background based on the current slide
stories.define('background--slide', function() {
  var module = this;
  var t;
  module.newSlide = function(e, targetSlide) {
    t.uiLayer.attr({'template': $(targetSlide).attr('template')});
  };

  return {
    tools: ['events', 'uiLayer'],
    entry: function(tools) {
      t = tools;
      module.uiLayer = tools.uiLayer;
      t.events.on("slide.change", module.newSlide.bind(this));
    },
  };
});

// Bottom blue bar
stories.define('progressBar--thin', function() {
  var module = this;
  var t;
  module.calcProgressBar = function(e, targetSlide) {
    var percentage = (this.currentSlideIndex) / (this.$slides.length - 1) * 100;
    t.uiLayer.css('width', percentage + '%');
  };

  return {
    tools: ['this', 'uiLayer', 'events'],
    entry: function(tools) {
      t = tools;
      t.events.on("slide.change", module.calcProgressBar.bind(t.this));
    },
  };
});

// Zooming of the slideshow
stories.define('zoom', function() {
  var module = this;
  var t;
  // The method we use for resizeZoom depends on which browser it is being
  // displayed in. We will try to use css3 transforms and if it is not
  // available, we will use zoom
  module.resizeZoomFactory = function() {
    var styleMethods = {
      simpleZoom: function(viewportWPadded, viewportHPadded, slidesAspectRatio, viewportAspectRatio) {
        if (slidesAspectRatio >= viewportAspectRatio) { // constrained by viewport width; vertically center
          var zoom = viewportWPadded / this.width;
          var marginTop = (viewportHPadded - (viewportWPadded/slidesAspectRatio)) / 2 + 'px';
          var marginLeft = 0;
        } else { // constrained by viewport height; horizontally center
          var zoom = viewportHPadded / this.height
          var marginTop = 0;
          var marginLeft = ((viewportWPadded - viewportHPadded*slidesAspectRatio)) / 2 + 'px';
        }
        this.$slidesContainer.css({
          'zoom': zoom,
          'margin-top': marginTop,
          'margin-left': marginLeft
        });
      },
      transformScale: function(viewportWPadded, viewportHPadded, slidesAspectRatio, viewportAspectRatio) {
        if (slidesAspectRatio >= viewportAspectRatio) { // constrained by viewport width; vertically center
          var scaleAmount = viewportWPadded / this.width;
          var resizeTransform = 'scale(' + scaleAmount + ')';
          var resizeTranslate = 'translate(' +
            0 + ',' +
            ((viewportHPadded - viewportWPadded/slidesAspectRatio) / 2) / scaleAmount + 'px' +
          ')';
        } else { // constrained by viewport height; horizontally center
          var scaleAmount = viewportHPadded / this.height;
          var resizeTransform = 'scale(' + scaleAmount + ')';
          var resizeTranslate = 'translate(' +
            ((viewportWPadded - viewportHPadded*slidesAspectRatio) / 2) / scaleAmount + 'px' + ',' +
            0 +
          ')';
        }
        this.$slidesContainer.css({
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

      var viewportWPadded = (viewportWRaw - this.options.zoomPadding * 2);
      var viewportHPadded = (viewportHRaw - this.options.zoomPadding * 2);

      var slidesAspectRatio = this.width / this.height;
      var viewportAspectRatio = viewportWPadded / viewportHPadded;

      preferredStyleMethod(viewportWPadded, viewportHPadded, slidesAspectRatio, viewportAspectRatio);
    };
  };

  module.bindResizeZoom = function() {
    $(window).on('resize orientationChanged', module.resizeZoom.bind(this));
  };

  return {
    tools: ['this'],
    entry: function(tools) {
      t = tools;
      module.resizeZoom = module.resizeZoomFactory.call(t.this);
      module.resizeZoom.call(t.this);
      module.bindResizeZoom.call(t.this);
    },
  };
});

// Single page advancement swipe
stories.define('simpleSwipe', function() {
  return {
    tools: ['this'],
    entry: function(tools) {
      var t = tools;
      if (typeof $.fn.swipe === 'undefined') {
        console.error("touchswipe plugin missing")
        return;
      }

      t.this.$slidesContainer.swipe({
        swipe: function(event, direction, distance, duration, fingerCount) {
          if (direction === "left") {
            this.nextSlide();
          } else if (direction === "right") {
            this.prevSlide();
          }
        }.bind(t.this)
      });
    },
  };
});

// Left right arrow key navigation
stories.define('arrowKeyNavigation', function() {
  return {
    tools: ['this'],
    entry: function(t) {
      $(document).keydown(function(e) { // TODO: figure out how to have this not conflict with other
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
      }.bind(t.this));
    },
  };
});
