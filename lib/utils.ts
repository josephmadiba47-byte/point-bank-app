/*
 * Formats a number to include commas and exactly two decimal places.
 * @param {number|string} amount - The price or total to format
 * @param {string} [symbol='$'] - Optional currency symbol prefix
 * @returns {string} The fully formatted price string
 */
export const formatCurrency = (amount: number | string, symbol = '$') => {
  // Convert string inputs (like form inputs or text rows) into raw numbers safely
  const numericValue = Number(amount);

  // Fallback to zero string layout if the input is corrupted or NaN
  if (isNaN(numericValue)) return `${symbol}0.00`;

  // COMBINES commas and exactly 2 decimal places in one sweep
  return symbol + numericValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const validatePasswordStrength = (password: string) => {
    if (!password) {
        return { isValid: false, message: "Password cannot be empty." };
    }
    if (password.length < 8) {
        return { isValid: false, message: "Password must be at least 8 characters long." };
    }
    if (!/[A-Z]/.test(password)) {
        return { isValid: false, message: "Password must contain at least one uppercase letter." };
    }
    if (!/[a-z]/.test(password)) {
        return { isValid: false, message: "Password must contain at least one lowercase letter." };
    }
    if (!/[0-9]/.test(password)) {
        return { isValid: false, message: "Password must contain at least one number." };
    }
    if (!/[@$!%*?&#]/.test(password)) {
        return { isValid: false, message: "Password must contain at least one special character (@, $, !, %, *, ?, &, #)." };
    }

    return { isValid: true, message: "Password meets all security compliance criteria." };
};

export const isValidEmailFormat = (emailStr: string) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(emailStr);
};
