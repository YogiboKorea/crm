const cap = 20, interval = 8000;
const perReq = Math.max(1, Math.min(cap, Math.floor(55000/interval)));
console.log('현재 기본 정책');
console.log('  하루 상한       :', cap, '통');
console.log('  발송 간격       :', interval/1000, '초');
console.log('  요청당 최대     :', perReq, '통  (60초 타임아웃 안에 처리 가능한 양)');
console.log('  409건 소요 예상 :', Math.ceil(409/cap), '일');
