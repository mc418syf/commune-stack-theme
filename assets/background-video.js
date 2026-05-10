document.addEventListener('alpine:init', () => {
  Alpine.data('BackgroundVideo', () => ({
    playing: false,
    player: null,
    init() {
      this.player = this.$root.querySelector('[\\@play][\\@pause]');

      this.player.addEventListener('playing', () => {
        this.playing = true;
      });

      this.player.addEventListener('paused', () => {
        this.playing = false;
      });

      document.addEventListener('shopify:section:unload', (e) => {
        if (e.target.contains(this.$root)) {
          this.deinit();
          this.player.dispatchEvent(new CustomEvent('deinit'));
        }
      });
    },
    play() {
      this.player.dispatchEvent(new CustomEvent('play'));
    },
    pause() {
      this.player.dispatchEvent(new CustomEvent('pause'));
    },
    deinit() {
      this.player.dispatchEvent(new CustomEvent('deinit'));
    },
  }));
});
