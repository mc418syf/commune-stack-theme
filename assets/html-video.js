document.addEventListener('alpine:init', () => {
  Alpine.data('HTMLVideo', () => ({
    init() {
      this.$refs.video.addEventListener('play', () => {
        this.$root.dispatchEvent(
          new CustomEvent('playing', {
            bubbles: true,
          })
        );
      });

      this.$refs.video.addEventListener('pause', () => {
        this.$root.dispatchEvent(
          new CustomEvent('paused', {
            bubbles: true,
          })
        );
      });

      // Safari won't autoplay inserted videos
      if (this.$refs.video.autoplay) {
        this.$nextTick(() => {
          this.$refs.video.play();
        });
      }
    },
    play() {
      this.$refs.video.play();
    },
    pause() {
      this.$refs.video.pause();
    },
  }));
});
