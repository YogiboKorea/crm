import fs from 'fs';
const src = fs.readFileSync('src/lib/schedule-runner.ts','utf8');
console.log('  OUTBOUND_LOCKED 체크 존재:', /if \(OUTBOUND_LOCKED\)/.test(src) ? 'O' : 'X');
console.log('  sendMail 호출보다 앞에 있나:',
  src.indexOf('if (OUTBOUND_LOCKED)') < src.indexOf('await sendMail(') ? 'O' : 'X');
const lock = fs.readFileSync('src/lib/outbound-lock.ts','utf8');
console.log('  OUTBOUND_LOCKED 값:', /OUTBOUND_LOCKED = (\w+)/.exec(lock)[1]);
