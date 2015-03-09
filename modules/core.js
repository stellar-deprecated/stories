stories.define('navButtons',
  ['background--slide', 'progressBar--thin'], function() {
  var module = this;

  return {
    entry: function() {
      this.$ui.prepend('<div class="navigation-buttons"><a class="nav-prev"></a><a class="nav-next"></a></div>');
      this.$navButtons = this.$ui.find('> .navigation-buttons');

      this.$navButtons.find('.nav-prev').click(this.prevSlide.bind(this));
      this.$navButtons.find('.nav-next').click(this.nextSlide.bind(this));
    },
  };
});

// Background based on the current slide
stories.define('background--slide', function() {
  var module = this;
  module.newSlide = function(e, targetSlide) {
    this.$background.attr({'template': $(targetSlide).attr('template')});
  };

  return {
    entry: function() {
      this.$ui.prepend('<div class="background"></div>');
      this.$background = this.$ui.find('> .background');
      this.on("slide.change", module.newSlide.bind(this));
    },
  };
});

// Bottom blue bar
stories.define('progressBar--thin', function() {
  var module = this;
  module.calcProgressBar = function(e, targetSlide) {
    var percentage = (this.currentSlideIndex) / (this.$slides.length - 1) * 100;
    this.$progressBar.css('width', percentage + '%');
  };

  return {
    entry: function() {
      this.$ui.append('<div class="progress-bar"></div>');
      this.$progressBar = this.$ui.find('.progress-bar');
      this.on("slide.change", module.calcProgressBar.bind(this));
    },
  };
});

// Zooming of the slideshow
stories.define('zoom', function() {
  var module = this;
  // The method we use for resizeZoom depends on which browser it is being
  // displayed in. We will try to use css3 transforms and if it is not
  // available, we will use zoom
  module.resizeZoomFactory = function() {
    var styleMethods = {
      simpleZoom: function(viewportWPadded, viewportHPadded, slidesAspectRatio, viewportAspectRatio) {
        if (slidesAspectRatio >= viewportAspectRatio) { // constrained by viewport width; vertically center
          this.$slidesContainer.css('zoom', viewportWPadded / this.width);
          this.$slidesContainer.css('margin-top', (viewportHPadded - (viewportWPadded/slidesAspectRatio)) / 2 + 'px');
          this.$slidesContainer.css('margin-left', 0);
        } else { // constrained by viewport height; horizontally center
          this.$slidesContainer.css('zoom', viewportHPadded / this.height);
          this.$slidesContainer.css('margin-top', 0);
          this.$slidesContainer.css('margin-left', ((viewportWPadded - viewportHPadded*slidesAspectRatio)) / 2 + 'px');
        }
      },
      transformScale: function(viewportWPadded, viewportHPadded, slidesAspectRatio, viewportAspectRatio) {
        if (slidesAspectRatio >= viewportAspectRatio) { // constrained by viewport width; vertically center
          this.$slidesContainer.css('transform', 'scale(' + viewportWPadded / this.width + ')');
          this.$slidesContainer.css('margin-top', (viewportHPadded - (viewportWPadded/slidesAspectRatio)) / 2 + 'px');
          this.$slidesContainer.css('margin-left', 0);
        } else { // constrained by viewport height; horizontally center
          this.$slidesContainer.css('transform', 'scale(' + viewportHPadded / this.height + ')');
          this.$slidesContainer.css('margin-top', 0);
          this.$slidesContainer.css('margin-left', ((viewportWPadded - viewportHPadded*slidesAspectRatio)) / 2 + 'px');
        }
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
    entry: function() {
      module.resizeZoom = module.resizeZoomFactory.call(this);
      module.resizeZoom.call(this);
      module.bindResizeZoom.call(this);
    },
  };
});

// Single page advancement swipe
stories.define('simpleSwipe', function() {
  return {
    entry: function() {
      if (typeof $.fn.swipe === 'undefined') {
        console.error("touchswipe plugin missing")
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
  };
});

// Left right arrow key navigation
stories.define('arrowKeyNavigation', function() {
  return {
    entry: function() {
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
  };
});
