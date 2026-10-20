import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { UPLOAD_DIR, uploadedFilePath } from '../server/http/serverKit';

// Code-scanning alerts 11–19: an uploaded file is read only from multer's own upload folder.
test('uploadedFilePath accepts multer files and refuses anything outside the upload folder', () => {
  const inside = path.join(UPLOAD_DIR, 'a1b2c3');
  assert.equal(uploadedFilePath({ path: inside }), path.resolve(inside));
  assert.throws(() => uploadedFilePath({ path: '/etc/passwd' }));
  assert.throws(() => uploadedFilePath({ path: path.join(UPLOAD_DIR, '..', 'elsewhere') }));
  assert.throws(() => uploadedFilePath({ path: UPLOAD_DIR + '-evil/x' }));
});
