import { OUTBOUND_LOCKED, OUTBOUND_LOCK_MESSAGE, canSendTo, TEST_RECIPIENTS } from './outbound-lock';
import { EmailTemplate } from '@/models/EmailTemplate';
import { EmailSchedule } from '@/models/EmailSchedule';
import { Lead } from '@/models/Lead';
import { sendMail, renderTemplate } from './mailer';
import { buildVarsFromLead, buildSignatureBlock } from './template-vars';
import { decryptSecret } from './crypto';
import { checkSendGuard } from './send-limits';
import { resolveOutreachAccount } from './mail/accounts';
import { loadTemplateAttachments } from './mail/template-attachments';
import { CONVERSATION_STAGES } from './stages';
import { scheduleKind } from './schedule-cancel';

/**
 * 예약 한 건을 실제로 보낸다 · Lead.emailHistory 기록 · 단계 이동 (queued/verified → contacted).
 * 크론 워커(/api/cron/process-schedules)와 [지금 보내기] 에서 같이 쓴다.
 *
 * ── 2026-10-20 고친 것 (예약 발송 점검) ──
 *  · 집기(claim): pending → sending 을 **한 번에** 바꾼 실행만 보낸다. 오전 9시 자동 처리와
 *    [지금 내보내기]·외부 깨우미가 겹쳐도 같은 곳에 두 번 나가지 않고, 보낸 것을 '실패'로 덮어쓰지 않는다.
 *    결과도 'sending' 일 때만 기록한다 — 그 사이 누가 취소했으면 덮어쓰지 않는다.
 *  · 보내는 순간 업체 상태 확인: 삭제·[검증 실패]·보관함·[발송 취소]로 옮겼거나, 답장이 왔으면
 *    보내지 않고 '취소'로 남긴다. 예전에는 미리 깔린 예약이 그대로 나가고 업체가 '발송 완료'로 되살아났다.
 *    (메일 쓰기 창에서 직접 잡은 예약은 기준이 다르다 — 아래 STOP_STAGES 설명)
 *  · 이번 발송만 고친 제목·본문(subjectOverride·bodyOverride) 이 있으면 그것으로 보낸다.
 *    화면이 "여기 보이는 그대로 나갑니다" 라고 하는데 양식 원문이 나가고 있었다.
 *  · 자동 재발송은 앞서 보낸 메일의 답장으로 보낸다 (In-Reply-To · "Re: 제목") —
 *    받는 쪽 메일함에서 같은 대화로 묶여 "같은 메일이 또 왔다" 가 아니라 "다시 여쭙는" 메일이 된다.
 *  · 발송 잠금 중이면 'pending' 으로 되돌리고 사유를 남긴다 (예전에는 아무 기록 없이 매번 다시 집었다).
 */

/**
 * 보내기 전에 멈추는 조건 — 예약이 어디서 왔는지(lib/schedule-cancel.ts scheduleKind)에 따라 다르다.
 *   모든 예약     → 업체 삭제 · [검증 실패] · 보관함이면 멈춘다. 예약한 **뒤에** 상대 답장이 왔으면 멈춘다.
 *   묶음 발송     → [보낼 메일](queued) 에 있는 곳만. [↩ 발송 취소] 는 queued → verified 로 되돌리므로
 *                  verified 를 받아 주면 취소한 곳에 그대로 나간다.
 *   자동 재발송   → 이미 한 번 보낸 [발송 완료](contacted) 인 곳만. 답장이 한 번이라도 왔으면 멈춘다.
 *   직접 잡은 예약 → 사람이 받는 곳을 골랐으므로 단계는 따지지 않는다 (메일 쓰기 창의 예약 발송).
 */
const STOP_STAGES = ['failed', 'archived'];

const STAGE_KO: Record<string, string> = {
  failed: '검증 실패', archived: '보관함', verifying: '검증 중', verified: '검증 완료(발송 취소)', imported: '가져온 업체',
  queued: '보낼 메일', contacted: '발송 완료',
  replied: '답장 받음', negotiating: '대화 진행 중', partner: '파트너십 확정',
};

export interface ScheduleItemResult {
  ok: boolean;
  error?: string;
  messageId?: string;
  dryRun?: boolean;
  /** 실제로 메일 서버에 보냈는가 — 처리기가 발송 간격(8초)을 이것만 보고 쉰다 */
  attempted?: boolean;
  /** 다른 실행이 먼저 집었거나 이미 끝난 예약 */
  skipped?: boolean;
  /** 업체 상태 때문에 보내지 않고 취소함 */
  canceled?: boolean;
}

export async function processScheduleItem(input: any): Promise<ScheduleItemResult> {
  const now = new Date();

  // ── 집기: 아직 pending 인 것만 sending 으로 — 둘이 동시에 와도 한 쪽만 성공한다 ──
  const doc: any = await EmailSchedule.findOneAndUpdate(
    { _id: input._id, status: 'pending' },
    { $set: { status: 'sending', claimedAt: now } },
    { new: true },
  ).lean();
  if (!doc) return { ok: false, skipped: true, error: '이미 처리 중이거나 끝난 예약입니다' };

  // 결과는 내가 집은 그대로(sending)일 때만 쓴다 — 그 사이 취소됐으면 덮어쓰지 않는다
  const finish = (set: Record<string, any>) => EmailSchedule.updateOne(
    { _id: doc._id, status: 'sending' },
    { $set: { ...set, claimedAt: null }, $inc: { attempts: 1 } },
  );
  const fail = async (error: string): Promise<ScheduleItemResult> => {
    await finish({ status: 'failed', lastError: error });
    return { ok: false, error };
  };
  const cancel = async (reason: string): Promise<ScheduleItemResult> => {
    await finish({ status: 'canceled', canceledReason: reason, lastError: '' });
    return { ok: false, canceled: true, error: reason };
  };

  const tpl: any = await EmailTemplate.findById(doc.templateId).lean();
  if (!tpl) return fail('메일 양식이 지워져서 보내지 못했습니다');

  const lead: any = await Lead.findOne({ leadId: doc.leadId }).lean();
  if (!lead || lead.deleted) return cancel('업체가 삭제되어 보내지 않았습니다');

  // ── 보내는 순간 업체 상태 다시 보기 ──
  const stageKo = `[${STAGE_KO[lead.stage] || lead.stage}]`;
  if (STOP_STAGES.includes(lead.stage)) return cancel(`업체가 ${stageKo} 에 있어 보내지 않았습니다`);
  const kind = scheduleKind(doc);
  // 예약한 뒤에 상대 메일이 왔으면 멈춘다 — 써 둔 내용이 지금 대화와 안 맞을 수 있다 (모든 예약)
  const inboundAt = lead.lastInboundAt ? new Date(lead.lastInboundAt).getTime() || 0 : 0;
  if (inboundAt && inboundAt > new Date(doc.createdAt).getTime()) {
    return cancel('예약한 뒤 업체에서 답장이 와서 보내지 않았습니다 — 받은 메일을 보고 다시 보내 주세요');
  }
  if (kind === 'followup') {
    // 재발송은 "답이 없을 때만" — 한 번이라도 답이 왔거나 대화 단계로 옮겼으면 멈춘다
    if (CONVERSATION_STAGES.includes(lead.stage) || (lead.inboundCount || 0) > 0) {
      return cancel('답장이 와서 재발송하지 않았습니다');
    }
    if (lead.stage !== 'contacted') return cancel(`업체가 ${stageKo} 에 있어 재발송하지 않았습니다`);
  } else if (kind === 'campaign') {
    // 묶음 발송은 [보낼 메일] 에 있는 곳만 — [↩ 발송 취소]·답장 받음 등으로 옮겼으면 멈춘다
    if (lead.stage !== 'queued') return cancel(`업체가 ${stageKo} 에 있어 보내지 않았습니다`);
  }

  // 발송 시점 재확인 — 예약 등록 후 시각까지 사이에 이미 여러 번 발송되었을 수 있음
  const guard = checkSendGuard({ emailHistory: lead.emailHistory, lastEmailSentAt: lead.lastEmailSentAt });
  if (!guard.ok) return fail(`발송 가드: ${guard.reason}`);

  // 보내는 계정 = 예약을 걸 때 고른 계정 (적힌 게 없으면 대표 계정).
  // 그 계정이 지워졌거나 사용 중지면 다른 주소로 대신 보내지 않고 실패로 남긴다
  // (예전처럼 .env 의 SMTP 로 조용히 대신 보내지도 않는다).
  const { account: acc, error: accError } = await resolveOutreachAccount(
    doc.mailAccountId,
    // 만든 사람이 있으면 그 사람 계정 범위로, 없으면(옛 예약) 마스터 계정 범위로
    doc.createdBy && doc.createdBy !== 'system' ? doc.createdBy : undefined,
  );
  if (!acc) return fail(accError || '보낼 메일 계정이 없습니다');
  let smtpPass = '';
  try {
    smtpPass = decryptSecret(acc.smtpPassEnc);
  } catch (e: any) {
    return fail(`계정 복호화 실패: ${e?.message || 'unknown'}`);
  }
  const smtpConfig = { host: acc.smtpHost, port: acc.smtpPort, secure: acc.smtpSecure, user: acc.smtpUser, pass: smtpPass };
  const fromOverride = { name: acc.fromName || acc.smtpUser, address: acc.fromAddress };

  // ── 제목·본문 — 이번 발송만 고친 것이 있으면 그것, 없으면 양식 ──
  const vars = buildVarsFromLead(lead);
  let renderedSubject = renderTemplate(String(doc.subjectOverride || tpl.subject || ''), vars);
  let renderedBody = renderTemplate(String(doc.bodyOverride || tpl.body || ''), vars);
  const appendSig = tpl.appendAccountSignature !== false;
  const sig = appendSig ? buildSignatureBlock(acc, { html: !!tpl.bodyIsHtml }) : '';
  if (sig) renderedBody = renderedBody + sig;

  // ── 자동 재발송이면 앞서 보낸 메일의 답장으로 — 받는 쪽에서 같은 대화로 묶인다 ──
  // (묶음 발송·직접 잡은 예약은 사람이 고른 제목 그대로 새 메일로 보낸다)
  const headers: Record<string, string> = {};
  if (kind === 'followup') {
    const prev = [...(lead.emailHistory || [])].reverse()
      .find((h: any) => h?.status === 'sent' && h.messageId && /@/.test(String(h.messageId)));
    if (prev) {
      headers['In-Reply-To'] = String(prev.messageId);
      headers['References'] = String(prev.messageId);
      const prevSubject = String(prev.subject || '').trim();
      if (prevSubject) renderedSubject = /^re\s*:/i.test(prevSubject) ? prevSubject : `Re: ${prevSubject}`;
    }
  }

  const fontFamily = 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif';
  const fontSize = 15;
  let htmlPayload: string | undefined;
  let textPayload: string | undefined;
  if (tpl.bodyIsHtml) {
    const bodyHtml = renderedBody.includes('<') ? renderedBody : renderedBody.replace(/\n/g, '<br>');
    htmlPayload = `<div style="font-family:${fontFamily};font-size:${fontSize}px;line-height:1.65;color:#111827">${bodyHtml}</div>`;
    textPayload = renderedBody.replace(/<[^>]+>/g, '');
  } else {
    textPayload = renderedBody;
  }

  // ⚠️ 예약 발송은 /api/mail/send 를 거치지 않는다. 그 라우트의 차단 스위치만
  //    믿으면 예약 시각이 됐을 때 그대로 나가버린다 (실제로 그런 구멍이 있었다).
  // 잠금 중에도 테스트 주소로는 나가게 둔다 — 예약 → 발송 → 수신까지 실제로 돌려봐야 하기 때문이다.
  // 그 외 주소는 막고, 예약은 pending 으로 되돌려 사유를 남긴다 (잠금을 풀면 그때 나간다).
  if (!canSendTo(doc.to)) {
    const why = OUTBOUND_LOCKED
      ? `발송 잠금 중 — 지금은 ${TEST_RECIPIENTS.join(', ')} 로만 나갑니다`
      : OUTBOUND_LOCK_MESSAGE;
    await EmailSchedule.updateOne({ _id: doc._id, status: 'sending' }, { $set: { status: 'pending', claimedAt: null, lastError: why } });
    console.log(`[schedule:LOCKED] 발송 차단 → to=${doc.to} subject=${renderedSubject.slice(0, 60)}`);
    return { ok: false, error: why };
  }

  const dryRun = process.env.MAIL_DRY_RUN === '1';
  let result: any;
  if (dryRun) {
    console.log(`[schedule:DRY_RUN] to=${doc.to} subject=${renderedSubject.slice(0, 60)}`);
    result = { ok: true, dryRun: true, messageId: `dryrun-sched-${Date.now()}` };
  } else {
    // 양식의 첨부를 보내는 순간 받아서 붙인다. 못 받으면 보내지 않고 실패로 남긴다
    // (발송함에 사유가 뜨고, 주소를 고친 뒤 다시 보낼 수 있다).
    const att = await loadTemplateAttachments(tpl.attachments);
    result = att.ok
      ? await sendMail({
          to: doc.to,
          subject: renderedSubject,
          html: htmlPayload,
          text: textPayload,
          headers: Object.keys(headers).length ? headers : undefined,
          attachments: att.files,
          smtpConfig,
          fromOverride,
          sentCopyAccount: acc,   // 보낸메일함에 사본을 남긴다
        })
      : { ok: false, error: att.error };
  }

  if (result.ok) {
    await finish({ status: 'sent', sentAt: now, lastError: '' });

    const historyItem: any = {
      subject: renderedSubject,
      body: renderedBody.slice(0, 500),
      templateId: doc.templateId,
      to: doc.to,
      sentAt: now.toISOString(),
      scheduledFor: new Date(doc.scheduledFor).toISOString(),
      // DRY_RUN 은 실제로 나가지 않았다. 이걸 'sent' 로 남기면 발송 횟수
      // 3회 한도가 테스트만으로 소진되고, 화면에도 "보낸 곳"으로 뜬다.
      status: dryRun ? 'scheduled' : 'sent',
      // 답장 매칭 열쇠 — 상대 답장의 In-Reply-To 가 이 값을 가리킨다 (match-lead.ts)
      messageId: result.messageId || '',
    };
    const setUpdate: any = { lastEmailSentAt: now.toISOString() };
    // 대화 중인 곳(답장 받음·협의·파트너)은 [발송 완료] 로 끌어내리지 않는다 — 직접 잡은 예약은 그런 곳에도 나간다
    if (!dryRun && lead.stage !== 'contacted' && !CONVERSATION_STAGES.includes(lead.stage)) {
      setUpdate.stage = 'contacted';
      setUpdate.stageChangedAt = now.toISOString();
    }
    await Lead.updateOne(
      { leadId: doc.leadId },
      { $push: { emailHistory: historyItem }, $set: setUpdate },
    );
    return { ok: true, attempted: true, messageId: result.messageId, dryRun: !!result.dryRun };
  }

  await finish({ status: 'failed', lastError: result.error || 'unknown' });
  await Lead.updateOne(
    { leadId: doc.leadId },
    {
      $push: {
        emailHistory: {
          subject: renderedSubject,
          templateId: doc.templateId,
          to: doc.to,
          sentAt: now.toISOString(),
          scheduledFor: new Date(doc.scheduledFor).toISOString(),
          status: 'failed',
          error: result.error || 'unknown',
        },
      },
    },
  );
  return { ok: false, attempted: true, error: result.error };
}
