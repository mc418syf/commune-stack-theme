document.addEventListener('alpine:init', () => {
  Alpine.data('Theme_RangeControl', (min, max, start, end) => ({
    min,
    max,
    valueA: start,
    valueB: end,
    ready: false,
    ignoreRangeStart: false,
    ignoreRangeEnd: false,
    get rangeStart() {
      return Math.min(this.valueA, this.valueB);
    },
    set rangeStart(value) {
      if (value >= this.rangeEnd) return;

      if (this.valueA < this.valueB) {
        this.valueA = value;
      } else {
        this.valueB = value;
      }
    },
    get rangeEnd() {
      return Math.max(this.valueA, this.valueB);
    },
    set rangeEnd(value) {
      if (value <= this.rangeStart) return;

      if (this.valueA > this.valueB) {
        this.valueA = value;
      } else {
        this.valueB = value;
      }
    },
    get rangeStartInMajorUnits() {
      return this.rangeStart / 100;
    },
    get rangeEndInMajorUnits() {
      return this.rangeEnd / 100;
    },
    get range() {
      return this.rangeEnd - this.rangeStart;
    },
    get rangeStartInPercent() {
      return this.normalize(this.rangeStart);
    },
    get rangeEndInPercent() {
      return this.normalize(this.rangeEnd);
    },
    get rangeInPercent() {
      return this.rangeEndInPercent - this.rangeStartInPercent;
    },
    get valueCenter() {
      // return Math.round(this.rangeStart + this.range / 2, 10);
      return this.rangeStart + this.range / 2;
    },
    set valueCenter(value) {
      const proposedRangeStart =
        Math.round((value - this.range / 2) / 100) * 100;
      const proposedRangeEnd = Math.round((value + this.range / 2) / 100) * 100;

      if (proposedRangeStart < this.min || proposedRangeEnd > this.max) {
        return;
      }
      this.rangeStart = proposedRangeStart;
      this.rangeEnd = proposedRangeEnd;
    },
    init() {
      this.$watch('rangeStart', (value, oldValue) => {
        if (value === oldValue || this.ignoreRangeStart) return;

        this.updateRangeStartDirectInputField(value);
      });

      this.$watch('rangeEnd', (value, oldValue) => {
        if (value === oldValue || this.ignoreRangeEnd) return;

        this.updateRangeEndDirectInputField(value);
      });

      this.$nextTick(() => {
        this.ready = true;
      });
    },
    normalize(value) {
      const ratio = (100 - 0) / (this.max - this.min);
      return (value - this.min) * ratio + 0;
    },
    updateRangeStartDirectInputField(value, triggerChange = true) {
      this.$refs.rangeStartDirectInputField.value = (value / 100).toString();

      this.$refs.rangeStartDirectInputField.dispatchEvent(new Event('remask'));
    },
    updateRangeEndDirectInputField(value, triggerChange = true) {
      this.$refs.rangeEndDirectInputField.value = (value / 100).toString();

      this.$refs.rangeEndDirectInputField.dispatchEvent(new Event('remask'));
    },
    handleRangeStartDirectInputFieldInput() {
      this.ignoreRangeStart = true;

      this.rangeStart = this.$el.value.replaceAll(/\D/g, '') * 100;

      this.$nextTick(() => {
        this.ignoreRangeStart = false;
      });

      this.$refs.rangeStartFormField.dispatchEvent(
        new CustomEvent('indirect-change')
      );
    },
    handleRangeEndDirectInputFieldInput() {
      this.ignoreRangeEnd = true;

      this.rangeEnd = this.$el.value.replaceAll(/\D/g, '') * 100;

      this.$nextTick(() => {
        this.ignoreRangeEnd = false;
      });

      this.$refs.rangeEndFormField.dispatchEvent(
        new CustomEvent('indirect-change')
      );
    },
    handleRangeStartDirectInputFieldChange() {
      this.$refs.rangeStartFormField.dispatchEvent(new Event('change'));
    },
    handleRangeEndDirectInputFieldChange() {
      this.$refs.rangeEndFormField.dispatchEvent(new Event('change'));
    },
    handleRangeStartControlChange() {
      this.$refs.rangeStartFormField.dispatchEvent(new Event('change'));
    },
    handleRangeEndControlChange() {
      this.$refs.rangeEndFormField.dispatchEvent(new Event('change'));
    },
    handleRangeCenterControlChange() {
      this.$refs.rangeStartFormField.dispatchEvent(new Event('change'));
    },
  }));
});
