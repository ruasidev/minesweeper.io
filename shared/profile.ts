// The rules for what a profile can hold, checked by the site before sending and by the server on arrival.
// Imported by both sides, so this file must not import anything else

// 3-20 letters, digits or underscores
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/

export const BIO_MAX = 200
