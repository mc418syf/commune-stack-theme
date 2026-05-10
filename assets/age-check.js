document.addEventListener('alpine:init', () => {
  Alpine.data(
    'AgeCheck',
    ({ mode, dateFormat, minimumAge, redirectURL, enabled }) => {
      return {
        authenticated: false,
        mode,
        dateFormat,
        minimumAge,
        redirectURL,
        month: '',
        day: '',
        year: '',
        date: '',
        enabled: enabled,
        sectionId: null,
        storageKey: null,
        get fullDate() {
          return `${this.month}/${this.day}/${this.year}`;
        },
        init() {
          this.sectionId = this.$root.id;
          this.storageKey = `switch-age-check-${this.sectionId}`;

          // Prevent age check on Shopify robot challenge page
          if (window.location.pathname === '/challenge') return;

          initTeleport(this.$root);

          Alpine.store('modals').register('ageCheck', 'modal');

          if (!Shopify.designMode) {
            if (getExpiringStorageItem(this.storageKey) !== 'approved') {
              Alpine.store('modals').open('ageCheck');
            }
          } else {
            if (window.theme.designMode.selected === this.sectionId) {
              if (this.enabled === true) {
                Alpine.store('modals').open('ageCheck');
              } else {
                // It might be open from a previous instantiation
                Alpine.store('modals').close('ageCheck');
              }
            }

            document.addEventListener(
              'shopify:section:select',
              this.onSectionSelect.bind(this)
            );

            document.addEventListener(
              'shopify:section:deselect',
              this.onSectionDeselect.bind(this)
            );
          }

          if (this.redirectURL === null) {
            this.redirectURL = 'https://www.google.com';
          }

          if (this.mode === 'dob') {
            this.date = new Date();
            setTimeout(() => this.setUpDOB(), 100);
          }
        },
        onSectionSelect(e) {
          if (!e.target.contains(this.$root)) return;

          if (!this.enabled) return;

          Alpine.store('modals').open('ageCheck');
        },
        onSectionDeselect(e) {
          if (!e.target.contains(this.$root)) return;

          this.$store.modals.close('ageCheck');
        },
        approveEntry() {
          Alpine.store('modals').close('ageCheck');

          if (!Shopify.designMode) {
            setExpiringStorageItem(this.storageKey, 'approved', daysInMs(30));
          }
        },
        denyEntry() {
          window.location = this.redirectURL;
        },
        checkInput(name) {
          switch (name) {
            case 'day':
              return parseInt(this.day) > 0 && parseInt(this.day) < 32
                ? true
                : false;
            case 'month':
              return parseInt(this.month) > 0 && parseInt(this.month) < 13
                ? true
                : false;
            case 'year':
              return parseInt(this.year) < this.date.getFullYear() &&
                parseInt(this.year) > 1900
                ? true
                : false;
          }
          return true;
        },
        checkAge() {
          const currentDate = Math.round(this.date.getTime() / 1000);
          const enteredDate = Math.round(
            new Date(`${this.fullDate}`).getTime() / 1000
          );

          const yearInSeconds = 31536000;

          const difference = Math.floor(
            (currentDate - enteredDate) / yearInSeconds
          );

          if (difference > parseInt(this.minimumAge, 10)) {
            this.approveEntry();
          } else {
            this.denyEntry();
          }
        },
        setUpDOB() {
          const container = document.getElementById(
            `dob-form-${this.sectionId}`
          );

          container.addEventListener('input', (e) => {
            const target = e.srcElement || e.target;
            const maxLength = parseInt(
              target.attributes['maxlength'].value,
              10
            );
            const targetLength = target.value.length;

            if (targetLength >= maxLength) {
              const valid = this.checkInput(target.getAttribute('name'));

              if (!valid) {
                target.value = '';
                return false;
              }

              let next = target.closest('.input-grid-item');

              while ((next = next.nextElementSibling)) {
                if (next == null) break;

                let input = next.querySelector('input');

                if (input !== null) {
                  input.focus();
                  break;
                }
              }
            }

            // Move to previous field if empty (user pressed backspace)
            else if (targetLength === 0) {
              let previous = target.closest('.input-grid-item');

              while ((previous = previous.previousElementSibling)) {
                if (previous == null) break;

                const input = previous.querySelector('input');

                if (input !== null) {
                  input.focus();
                  break;
                }
              }
            }
            if (
              this.checkInput('day') &&
              this.checkInput('month') &&
              this.checkInput('year')
            ) {
              setTimeout(() => this.checkAge(), 500);
            }
          });
        },
        destroy() {
          document.removeEventListener(
            'shopify:section:select',
            this.onSectionSelect
          );

          document.removeEventListener(
            'shopify:section:deselect',
            this.onSectionDeselect
          );
        },
      };
    }
  );
});
