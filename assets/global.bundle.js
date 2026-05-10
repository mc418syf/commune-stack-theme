/**
 * Currency Helpers
 * -----------------------------------------------------------------------------
 * A collection of useful functions that help with currency formatting
 *
 * Current contents
 * - formatMoney - Takes an amount in cents and returns it as a formatted dollar value.
 *
 */

const moneyFormat = '${{amount}}';

/**
 * Format money values based on your shop currency settings
 * @param  {Number|string} cents - value in cents or dollar amount e.g. 300 cents
 * or 3.00 dollars
 * @param  {String} format - shop money_format setting
 * @return {String} value - formatted value
 */
function formatMoney(cents, format) {
  if (typeof cents === 'string') {
    cents = cents.replace('.', '');
  }
  let value = '';
  const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
  const formatString = format || moneyFormat;
  function formatWithDelimiters(number) {
    let precision = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 2;
    let thousands = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : ',';
    let decimal = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '.';
    if (isNaN(number) || number == null) {
      return 0;
    }
    number = (number / 100.0).toFixed(precision);
    const parts = number.split('.');
    const dollarsAmount = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, `$1${thousands}`);
    const centsAmount = parts[1] ? decimal + parts[1] : '';
    return dollarsAmount + centsAmount;
  }
  switch (formatString.match(placeholderRegex)[1]) {
    case 'amount':
      value = formatWithDelimiters(cents, 2);
      break;
    case 'amount_no_decimals':
      value = formatWithDelimiters(cents, 0);
      break;
    case 'amount_with_comma_separator':
      value = formatWithDelimiters(cents, 2, '.', ',');
      break;
    case 'amount_no_decimals_with_comma_separator':
      value = formatWithDelimiters(cents, 0, '.', ',');
      break;
  }
  return formatString.replace(placeholderRegex, value);
}

/**
 * Generic live region announcement
 *
 */
function liveRegion(content, clear) {
  clearTimeout(window.liveRegionTimeout);
  let region = document.getElementById('screenreader-announce');
  region.innerHTML = content;
  window.liveRegionTimeout = setTimeout(() => {
    region.innerHTML = '';
  }, 3000);
}
function cartLiveRegion(item) {
  const templateString = theme.strings.update + ': [QuantityLabel]: [Quantity], [Regular] [$$] [DiscountedPrice] [$]. [PriceInformation]';
  function _liveRegionContent() {
    let liveRegionContent = templateString;
    liveRegionContent = liveRegionContent.replace('[QuantityLabel]', theme.strings.quantity).replace('[Quantity]', item.quantity);
    let regularLabel = '';
    let regularPrice = formatMoney(item.original_line_price, theme.moneyFormat);
    let discountLabel = '';
    let discountPrice = '';
    let discountInformation = '';
    if (item.original_line_price > item.final_line_price) {
      regularLabel = theme.strings.regularTotal;
      discountLabel = theme.strings.discountedTotal;
      discountPrice = formatMoney(item.final_line_price, theme.moneyFormat);
      discountInformation = theme.strings.priceColumn;
    }
    liveRegionContent = liveRegionContent.replace('[Regular]', regularLabel).replace('[$$]', regularPrice).replace('[DiscountedPrice]', discountLabel).replace('[$]', discountPrice).replace('[PriceInformation]', discountInformation).replace('  .', '').trim();
    return liveRegionContent;
  }
  liveRegion(_liveRegionContent());
}
function variantLiveRegion(variant) {
  const templateString = '[Availability] [Regular] [$$] [Sale] [$]. [UnitPrice] [$$$]';
  function _getBaseUnit() {
    if (variant.unit_price_measurement.reference_value === 1) {
      return variant.unit_price_measurement.reference_unit;
    }
    return variant.unit_price_measurement.reference_value + variant.unit_price_measurement.reference_unit;
  }

  /**
   * Compose the live region’s content based on the
   * variant’s properties.
   *
   * @param {Object} variant The variant
   */
  function _liveRegionContent() {
    let liveRegionContent = templateString;

    // Update availability
    const availability = variant.available ? '' : theme.strings.soldOut + ',';
    liveRegionContent = liveRegionContent.replace('[Availability]', availability);

    // Update pricing
    let regularLabel = '';
    let regularPrice = formatMoney(variant.price, theme.moneyFormat);
    let saleLabel = '',
      salePrice = '',
      unitLabel = '',
      unitPrice = '';
    if (variant.compare_at_price > variant.price) {
      regularLabel = theme.strings.regularPrice;
      regularPrice = formatMoney(variant.compare_at_price, theme.moneyFormat);
      saleLabel = theme.strings.sale;
      salePrice = formatMoney(variant.price, theme.moneyFormat);
    }
    if (variant.unit_price) {
      unitLabel = theme.strings.unitPrice;
      unitPrice = formatMoney(variant.unit_price, theme.moneyFormat) + ' ' + theme.strings.unitPriceSeparator + ' ' + _getBaseUnit();
    }
    liveRegionContent = liveRegionContent.replace('[Regular]', regularLabel).replace('[$$]', regularPrice).replace('[Sale]', saleLabel).replace('[$]', salePrice).replace('[UnitPrice]', unitLabel).replace('[$$$]', unitPrice).replace('  .', '').trim();
    return liveRegionContent;
  }
  liveRegion(_liveRegionContent());
}
window.liveRegion = liveRegion;
window.variantLiveRegion = variantLiveRegion;
window.cartLiveRegion = cartLiveRegion;
if (!window.formatMoney) {
  window.formatMoney = function (amount) {
    let format = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : theme.defaultMoneyFormat;
    return formatMoney(amount, format);
  };
}
console.log('Baseline theme (3.2.0) by SWITCH | Make the switch: https://switchthemes.co');
