/**
 * Formats a currency amount to Indian Rupees (₹) or 'Free' if 0.
 * @param {number|string} amount - The amount to format
 * @returns {string} - Formatted string (e.g., "₹29", "₹499", "Free")
 */
export const formatPrice = (amount) => {
    const numAmount = Number(amount);

    if (isNaN(numAmount)) return 'Free'; // Fallback for invalid numbers
    if (numAmount === 0) return 'Free';

    return `₹${numAmount}`;
};
