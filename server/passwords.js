const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const SCRYPT_COST = 32768;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_PASSWORD_LENGTH = 1024;
const MIN_PASSWORD_LENGTH = 8;
const SCRYPT_OPTIONS = {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: 64 * 1024 * 1024
};
const HASH_PATTERN = /^scrypt\$1\$32768\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/;

class PasswordValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PasswordValidationError';
    }
}

class PasswordConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PasswordConfigurationError';
    }
}

function validateNewPassword(password) {
    if (typeof password !== 'string') {
        throw new PasswordValidationError('Passwords must be text.');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
        throw new PasswordValidationError(`Passwords must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
        throw new PasswordValidationError(`Passwords must be no more than ${MAX_PASSWORD_LENGTH} characters long.`);
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        throw new PasswordValidationError('Passwords must include an uppercase letter, a lowercase letter, a number, and a special character.');
    }
}

function hashPasswordSync(password) {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    return `scrypt$1$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

function ensurePasswordHash(password) {
    if (typeof password !== 'string') {
        throw new PasswordConfigurationError('Configured passwords must be strings.');
    }
    if (password === '') {
        return '';
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
        throw new PasswordConfigurationError(`Configured passwords must be no more than ${MAX_PASSWORD_LENGTH} characters long.`);
    }
    if (password.startsWith('scrypt$')) {
        if (!HASH_PATTERN.test(password)) {
            throw new PasswordConfigurationError('The config contains an invalid password hash.');
        }
        return password;
    }
    return hashPasswordSync(password);
}

async function verifyPassword(password, passwordHash) {
    if (typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH ||
        typeof passwordHash !== 'string') {
        return false;
    }

    const match = HASH_PATTERN.exec(passwordHash);
    if (!match) {
        return false;
    }

    const salt = Buffer.from(match[1], 'hex');
    const expectedKey = Buffer.from(match[2], 'hex');
    const actualKey = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    return crypto.timingSafeEqual(actualKey, expectedKey);
}

module.exports = {
    MAX_PASSWORD_LENGTH,
    MIN_PASSWORD_LENGTH,
    PasswordConfigurationError,
    PasswordValidationError,
    ensurePasswordHash,
    hashPasswordSync,
    validateNewPassword,
    verifyPassword
};
