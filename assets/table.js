document.addEventListener('alpine:init', () => {
  Alpine.data('Theme_Table', () => ({
    sortCol: 0,
    sortOrder: 'asc',
    sortOpen: false,
    originalItems: [],
    mobileSortLabel: '',
    initialSortComplete: false,
    init() {
      this.originalItems = [...this.$refs.tableData.children];
      this.mobileSortLabel =
        this.$refs.tableHeader.children[this.sortCol].dataset.sortLabel;
      this.sortItems();
      this.initialSortComplete = true;
    },
    sort(colIndex) {
      this.sortOrder =
        this.sortCol === colIndex && this.sortOrder === 'asc' ? 'desc' : 'asc';
      this.sortCol = colIndex;
      this.sortItems();
    },
    mobileSort(colIndex, order) {
      this.sortOrder = order;
      this.sortCol = colIndex;
      this.sortItems();
      this.mobileSortLabel =
        this.$refs.tableHeader.children[this.sortCol].dataset.sortLabel;
      this.sortOpen = false;
    },
    sortItems() {
      const tableContainer = this.$refs.tableData;
      const rows = tableContainer.children;
      const rowsArray = Array.from(rows);

      //sort items in array by data-sort-value attribute of the column
      rowsArray.sort((a, b) => {
        const aSortValue = a
          .querySelector(`[data-index="${this.sortCol}"]`)
          .dataset.sortValue.toLowerCase();
        const bSortValue = b
          .querySelector(`[data-index="${this.sortCol}"]`)
          .dataset.sortValue.toLowerCase();

        //check if value is number, is so, convert to number
        if (!isNaN(aSortValue) && !isNaN(bSortValue)) {
          return this.sortOrder === 'asc'
            ? aSortValue - bSortValue
            : bSortValue - aSortValue;
        }

        //check if value is boolean, is so, sort as boolean
        if (isBooleanString(aSortValue) && isBooleanString(bSortValue)) {
          const aSortBoolValue = stringToBoolean(aSortValue);
          const bSortBoolValue = stringToBoolean(bSortValue);

          if (aSortBoolValue === bSortBoolValue) {
            return 0;
          }

          if (aSortBoolValue) {
            return this.sortOrder === 'asc' ? -1 : 1;
          } else {
            return this.sortOrder === 'asc' ? 1 : -1;
          }
        }

        if (aSortValue < bSortValue) {
          return this.sortOrder === 'asc' ? -1 : 1;
        }
        if (aSortValue > bSortValue) {
          return this.sortOrder === 'asc' ? 1 : -1;
        }
        return 0;
      });

      tableContainer.innerHTML = '';
      rowsArray.forEach((row) => tableContainer.appendChild(row));
    },
    restoreOriginalItems() {
      const tableContainer = this.$refs.tableData;
      tableContainer.innerHTML = '';
      this.originalItems.forEach((item) => tableContainer.appendChild(item));
    },
  }));
});
