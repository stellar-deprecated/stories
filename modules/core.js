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
  module.resizeZoom = function() {
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
  };

  module.bindResizeZoom = function() {
    module.resizeZoom.call(this);
    $(window).on('resize orientationChanged', module.resizeZoom.bind(this));
  };

  return {
    entry: function() {
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
