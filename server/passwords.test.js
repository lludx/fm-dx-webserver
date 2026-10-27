const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MIN_PASSWORD_LENGTH,
    PasswordConfigurationError,
    PasswordValidationError,
    ensurePasswordHash,
    validateNewPassword,
    verifyPassword
} = require('./passwords');

test('password hashes are salted and verify only the matching password', async () => {
    const firstHash = ensurePasswordHash('correct horse battery staple');
    const secondHash = ensurePasswordHash('correct horse battery staple');

    assert.match(firstHash, /^scrypt\$1\$32768\$8\$1\$/);
    assert.notEqual(firstHash, secondHash);
    assert.equal(await verifyPassword('correct horse battery staple', firstHash), true);
    assert.equal(await verifyPassword('incorrect password', firstHash), false);
});

test('legacy configured passwords are upgraded without exposing plaintext', async () => {
    const migratedHash = ensurePasswordHash('existing legacy password');

    assert.notEqual(migratedHash, 'existing legacy password');
    assert.equal(ensurePasswordHash(migratedHash), migratedHash);
    assert.equal(await verifyPassword('existing legacy password', migratedHash), true);
});

test('new passwords must meet the length and character requirements', () => {
    assert.doesNotThrow(() => validateNewPassword(`Aa1!${'a'.repeat(MIN_PASSWORD_LENGTH - 4)}`));
    assert.throws(() => validateNewPassword('Aa1!abc'), PasswordValidationError);
    assert.throws(() => validateNewPassword('Abcdefg!'), PasswordValidationError);
    assert.throws(() => validateNewPassword('abcdefg1'), PasswordValidationError);
    assert.throws(() => validateNewPassword('ABCDEFG1'), PasswordValidationError);
    assert.throws(() => validateNewPassword('Aa1!'.padEnd(1025, 'a')), PasswordValidationError);
});

test('malformed stored hashes fail closed', async () => {
    assert.throws(() => ensurePasswordHash('scrypt$invalid'), PasswordConfigurationError);
    assert.equal(await verifyPassword('some password', 'scrypt$invalid'), false);
});
