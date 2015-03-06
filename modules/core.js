$.fn.stories.modules['navButtons'] = function() {
  var module = this;

  return {
    deps: [
      "background--slide",
    ],
    entry: function() {
      this.$ui.prepend('<div class="navigation-buttons"><a class="nav-prev"></a><a class="nav-next"></a></div>');
      this.$navButtons = this.$ui.find('> .navigation-buttons');

      this.$navButtons.find('.nav-prev').click(this.prevSlide.bind(this));
      this.$navButtons.find('.nav-next').click(this.nextSlide.bind(this));
    },
  };
}

// Background based on the current slide
$.fn.stories.modules['background--slide'] = function() {
  var module = this;
  module.newSlide = function(e, targetSlide) {
    this.$background.attr({'template': $(targetSlide).attr('template')});
  };

  return {
    deps: [
      "",
    ],
    entry: function() {
      this.$ui.prepend('<div class="background"></div>');
      this.$background = this.$ui.find('> .background');
      this.on("slide.change", module.newSlide.bind(this));
    },
  };
}
