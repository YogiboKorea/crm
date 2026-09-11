/**
 * 보고 자리에서 각 화면에 무엇이 뜨는지 미리 본다.
 *
 * 빈 화면이 이어지면 "만들다 만 것" 처럼 보인다. 어디가 비어 있는지
 * 미리 알고 들어가야 설명 순서를 짤 수 있다.
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
const KST=9*3600000;
await mongoose.connect(process.env.MONGODB_URI);
const L=mongoose.connection.collection('leads');
const M=mongoose.connection.collection('inboundmails');
const T=mongoose.connection.collection('emailtemplates');
const S=mongoose.connection.collection('emailschedules');
const A=mongoose.connection.collection('mailaccounts');
const alive={deleted:{$ne:true}};
const REAL={Email:{$regex:/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/}};
const NOISE=['ad','system','newsletter'];
const replySince=new Date(Date.now()-14*86400000);
const monthSince=new Date(Date.now()-60*86400000);
const dayStart=(()=>{const s=new Date(Date.now()+KST);s.setUTCHours(0,0,0,0);return new Date(s.getTime()-KST);})();

const row=(icon,name,n,note)=>console.log(`  ${icon} ${name.padEnd(22)} ${String(n).padStart(6)}  ${n===0?'⚠ 비어 있음 — ':''}${note||''}`);

console.log('── 리드 파이프라인 ──');
row('✅','AI 검증 완료', await L.countDocuments({stage:'verified',...alive}), '전부 AI 판정 완료');
const q=await L.countDocuments({stage:'queued',...alive});
const c=await L.countDocuments({stage:'contacted',...alive});
row('📨','발송 관리', q+c, `보낼메일 ${q} · 발송완료 ${c} · 예약 ${await S.countDocuments({status:'pending'})}`);
row('💬','답장 받음', await L.countDocuments({stage:'replied',...alive}));
row('🤝','대화 진행 중', await L.countDocuments({stage:'negotiating',...alive}));
row('⭐','파트너십 확정', await L.countDocuments({stage:'partner',...alive}), '카드뷰 · 대화 이력 있음');

console.log('\n── 메일함 ──');
row('📥','받은 메일함', await M.countDocuments({trashedAt:null,direction:'in',classification:{$nin:NOISE},date:{$gte:monthSince}}), '최근 2개월');
row('📨','오늘 온 메일', await M.countDocuments({trashedAt:null,direction:'in',date:{$gte:dayStart}}));
row('⚠️','회신 필요', await M.countDocuments({trashedAt:null,direction:'in',classification:{$nin:NOISE},'analysis.needsReply':true,status:{$in:['new','reviewing']},date:{$gte:replySince}}), '최근 14일');
row('⏰','기한 관리', await M.countDocuments({trashedAt:null,direction:'in',classification:{$nin:NOISE},'analysis.deadline':{$ne:null},status:{$nin:['replied','archived','ignored']},date:{$gte:monthSince}}));

console.log('\n── 올린 데이터 ──');
const batches=await L.aggregate([{$match:{importBatch:{$not:/^ai-search-/},...alive}},{$group:{_id:'$importBatch',n:{$sum:1}}}]).toArray();
row('📚','올린 업체 목록', batches.length, `파일 ${batches.length}개 · 업체 ${batches.reduce((a,b)=>a+b.n,0)}`);
row('🔎','직접 검토 대상', await L.countDocuments({importBatch:{$not:/^ai-search-/},stage:{$in:['imported','verifying','archived','ai-searched']},...alive,...REAL,legacyHiddenAt:{$exists:false},'verification.aiVerdict':{$ne:'not-buyer'}}));

console.log('\n── 설정 ──');
row('📝','메일 양식', await T.countDocuments({}), '※ 문구는 대표님 확정 필요');
row('📬','발송 계정', await A.countDocuments({isActive:{$ne:false}}));
row('🚫','검증 실패', await L.countDocuments({stage:'failed',...alive}));

console.log('\n── 보고 때 비어 보일 화면 ──');
const empties=[];
for(const [name,n] of [['발송 관리',q+c],['답장 받음',await L.countDocuments({stage:'replied',...alive})],['대화 진행 중',await L.countDocuments({stage:'negotiating',...alive})]]) if(!n) empties.push(name);
console.log(empties.length? '  '+empties.join(' · ')+'  ← 테스트 정리로 0이 됐습니다' : '  없음');
await mongoose.disconnect();
