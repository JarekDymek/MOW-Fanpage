import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceCredentials,normalizeWorkEmail,validWorkEmail} from '../src/lib/access.js';

test('Access accepts only the MOW work domain',()=>{
  assert.equal(validWorkEmail(' JAN.KOWALSKI@mowmalbork.pl '),true);
  for(const email of ['jan@gmail.com','jan@mowmalbork.pl.evil.invalid','jan@sub.mowmalbork.pl',''])assert.equal(validWorkEmail(email),false,email);
  assert.equal(normalizeWorkEmail(' USER@MOWMALBORK.PL '),'user@mowmalbork.pl');
});

test('Device credentials are strong and unique',()=>{
  const a=createDeviceCredentials(),b=createDeviceCredentials();
  assert.match(a.deviceId,/^[0-9a-f-]{36}$/i);
  assert.match(a.deviceSecret,/^[0-9a-f]{64}$/);
  assert.notEqual(a.deviceId,b.deviceId);
  assert.notEqual(a.deviceSecret,b.deviceSecret);
});
