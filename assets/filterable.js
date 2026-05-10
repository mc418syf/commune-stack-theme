document.addEventListener('alpine:init', () => {
  Alpine.data('Filterable', () => ({
    filtersOpen: false,
    sortOpen: false,
    filtersCache: [],
    price_range: null,
    loading: false,
    focusedBeforeUpdate: null,
    searchParams: null,
    countHTML: null,
    filtersFormHTML: null,
    resultsHTML: null,
    drawerToggleHTML: null,
    afterUpdateCallback: null,
    isMdBreakpoint: window.isMdBreakpoint(),
    mdBreakpointMQL: window.mdBreakpointMQL(),
    clickOutside(event, property, sidebarOnDesktop) {
      if (!(sidebarOnDesktop && this.isMdBreakpoint)) {
        event.preventDefault();
      }

      if (
        event.target &&
        (event.target === this.$refs.filterDropDownToggle ||
          event.target === this.$refs.sortDropDownToggle)
      )
        return;

      this[property] = false;
    },
    focusOut(event, property) {
      if (event.relatedTarget) {
        if (
          event.relatedTarget === this.$refs.filterDropDownToggle ||
          event.relatedTarget === this.$refs.sortDropDownToggle
        )
          return;

        const dropdownParent = event.relatedTarget.closest(
          '[data-filterable-dropdown]'
        );

        if (!dropdownParent) {
          this[property] = false;
        }
      }
    },
    onEscape() {
      if (this.filtersOpen) {
        this.filtersOpen = false;
        this.$refs.filterDropDownToggle.focus();
      }
      if (this.sortOpen) {
        this.sortOpen = false;
        this.$refs.sortToggle.focus();
      }
    },
    init() {
      this.isMdBreakpoint = this.mdBreakpointMQL.matches;

      this.mdBreakpointMQL.addEventListener('change', (e) => {
        this.isMdBreakpoint = e.matches;
      });

      this.$root.addEventListener('baseline:filterable:open-filters', () => {
        this.filtersOpen = true;
      });

      window.addEventListener('popstate', this.onHistoryChange.bind(this));

      this.$watch('sortOpen', (value) => {
        if (value === true && this.filtersOpen === true) {
          this.filtersOpen = false;
        }
      });

      this.$watch('filtersOpen', (value) => {
        if (value === true && this.sortOpen === true) {
          this.sortOpen = false;
        }
      });

      this.$watch('searchParams', this.onSearchParamsUpdate.bind(this));
    },
    async onSearchParamsUpdate(value, oldValue) {
      if (value === oldValue) return;

      // this.beforeUpdate();

      /**
       * [...value] turns searchParams into an array
       * so we can add the section_id in place without
       * modifying the searchParams prop.
       *
       * We use an array instead of an object because
       * filters can have multiple values, so the searchParams
       * needs to support duplicate keys with different
       * values.
       */

      const updatedHTML = await fetchHTML(
        currentURLAddingParams(
          [...value, ['section_id', getSectionId(this.$root)]],
          true
        )
      );

      if (this.$root.querySelector(`[data-fragment-id="count"]`)) {
        this.countHTML = querySelectorInHTMLString(
          `[data-fragment-id="count"]`,
          updatedHTML
        ).innerHTML;
      }

      if (this.$root.querySelector(`[data-fragment-id="drawer-toggle"]`)) {
        this.drawerToggleHTML = querySelectorInHTMLString(
          `[data-fragment-id="drawer-toggle"]`,
          updatedHTML
        ).innerHTML;
      }

      const filterFormFragmentIds = [
        'filters-form-sidebar',
        'filters-form-filters-drop-down',
        'filters-form-sort-drop-down',
        'filters-form-drawer',
      ];

      for (const fragmentId of filterFormFragmentIds) {
        let fragmentEl, updatedFormFragmentEl;
        if (fragmentId === 'filters-form-drawer') {
          fragmentEl = document.getElementById('filters-form-drawer');

          if (!fragmentEl) continue;

          updatedFormFragmentEl = querySelectorInHTMLString(
            `[data-template-fragment-id="${fragmentId}"]`,
            updatedHTML
          ).content.firstElementChild.querySelector(
            `[data-fragment-id="${fragmentId}"]`
          );

          if (!updatedFormFragmentEl) continue;
        } else {
          fragmentEl = this.$root.querySelector(
            `[data-fragment-id="${fragmentId}"]`
          );

          if (!fragmentEl) continue;

          updatedFormFragmentEl =
            querySelectorInHTMLString(
              `[data-fragment-id="${fragmentId}"]`,
              updatedHTML
            ) || null;

          if (!updatedFormFragmentEl) continue;
        }

        fragmentEl
          .querySelectorAll('[data-filterable-filter-fragment]')
          .forEach((filterableFragmentEl) => {
            const updatedFragment = updatedFormFragmentEl.querySelector(
              `[data-filterable-filter-fragment="${filterableFragmentEl.getAttribute(
                'data-filterable-filter-fragment'
              )}"`
            ).innerHTML;

            if (updatedFragment)
              filterableFragmentEl.innerHTML = updatedFragment;
          });
      }

      this.resultsHTML = querySelectorInHTMLString(
        `[data-fragment-id="results"]`,
        updatedHTML
      ).innerHTML;

      this.afterUpdate();
    },
    // beforeUpdate() {},
    afterUpdate() {
      if (
        this.focusedBeforeUpdate &&
        document.getElementById(this.focusedBeforeUpdate)
      ) {
        const target = document.getElementById(this.focusedBeforeUpdate);

        this.$focus.focus(target);

        if (target.tagName === 'INPUT' && target.type === 'text') {
          target.select();
        }
        this.focusedBeforeUpdate = null;
      }

      if (!this.historyChanged) {
        this.updateURLHash(this.searchParams);
      } else {
        this.historyChanged = false;
      }

      this.loading = false;

      if (this.afterUpdateCallback) {
        this.$nextTick(() => {
          this.afterUpdateCallback();
          this.afterUpdateCallback = null;
        });
      }
    },
    filterFormSubmit(event) {
      const form = event.target.closest('form');

      if (this.loading || !form) return;
      this.loading = true;

      if (
        document.activeElement &&
        this.$root.contains(document.activeElement)
      ) {
        const targetId = document.activeElement.getAttribute('id');

        if (targetId) {
          this.focusedBeforeUpdate = targetId;
        }
      }

      const formData = new FormData(event.target.closest('form'));

      this.searchParams = new URLSearchParams(formData);

      if (event.target.name && event.target.name == 'sort_by') {
        this.afterUpdateCallback = () => {
          this.sortOpen = false;
        };
      }
    },
    clearAllFilters() {
      this.searchParams = new URL(this.$event.currentTarget.href).searchParams;
    },
    updateURLHash(searchParams) {
      const searchParamsString = searchParams.toString();

      history.pushState(
        { searchParamsString },
        '',
        `${window.location.pathname}${
          searchParamsString && '?'.concat(searchParamsString)
        }`
      );
    },
    onHistoryChange(event) {
      this.historyChanged = true;

      this.searchParams = event.state.searchParams || '';
    },
  }));
});
