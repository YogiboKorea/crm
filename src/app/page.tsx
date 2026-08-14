'use client';

import Script from 'next/script';

export default function Home() {
  return (
    <>
      {/* 상단 progress bar (전역 전환 표시) */}
      <div id="topProgressBar" aria-hidden="true"></div>

      {/* 전체 차단 오버레이 (중요한 작업 진행 중) */}
      <div id="globalBlocker" role="status" aria-live="polite">
        <div className="blocker-card">
          <div className="blocker-spinner"></div>
          <div className="blocker-text" id="globalBlockerText">불러오는 중...</div>
        </div>
      </div>

      <div className="app-shell">
        <aside className="sidebar">
          {/* 사이드바 접기/펴기 토글 */}
          <button id="sidebarToggleBtn" className="sidebar-toggle" type="button"
            title="사이드바 접기/펴기 (Ctrl+B)" aria-label="사이드바 접기/펴기">
            <span className="sidebar-toggle-icon">‹</span>
          </button>
          <button id="homeBtn" className="brand" type="button" aria-label="Reset filters and go to Leads">
            <div className="brand-mark">
              <img src="/assets/logo.png" alt="Yogico" className="brand-logo"
                onError={(e) => { (e.target as HTMLImageElement).src = '/assets/logo.png'; }} />
            </div>
            <div className="brand-text">
              <h1>Yogico CRM</h1>
              <p>Importer &amp; buyer pipeline</p>
            </div>
          </button>
          <nav className="nav" aria-label="Pipeline">
            {/* ── 새 파이프라인 (좌 → 우 순서) ─ 접힘 상태에서 아이콘만 보이도록 span 분리 ─ */}
            <button className="nav-item active" data-view="pipeline-import" type="button" title="가져오기 (Import)">
              <span className="nav-icon">📥</span><span className="nav-label">가져오기 (Import)</span>
            </button>
            <button className="nav-item" data-view="pipeline-verifying" type="button" title="검증 대기">
              <span className="nav-icon">🔍</span><span className="nav-label">검증 대기</span>
            </button>
            <button className="nav-item" data-view="pipeline-verified" type="button" title="검증 완료 (성공/실패 탭)">
              <span className="nav-icon">✅</span><span className="nav-label">검증 완료</span>
            </button>
            <button className="nav-item" data-view="pipeline-contacted" type="button" title="컨택 중">
              <span className="nav-icon">📨</span><span className="nav-label">컨택 중</span>
            </button>
            <button className="nav-item" data-view="pipeline-replied" type="button" title="응답 옴">
              <span className="nav-icon">💬</span><span className="nav-label">응답 옴</span>
            </button>
            <button className="nav-item" data-view="pipeline-negotiating" type="button" title="협상 중">
              <span className="nav-icon">🤝</span><span className="nav-label">협상 중</span>
            </button>
            <button className="nav-item" data-view="pipeline-partner" type="button" title="파트너 (완료)">
              <span className="nav-icon">⭐</span><span className="nav-label">파트너 (완료)</span>
            </button>
            <div className="nav-divider"></div>
            {/* ── 부가 도구 ────────────────────────────────── */}
            <button className="nav-item" data-view="tool-b2b-email" type="button" title="B2B 메일 관리">
              <span className="nav-icon">📤</span><span className="nav-label">B2B 메일 관리</span>
            </button>
            <button className="nav-item" data-view="tool-mail-accounts" type="button" title="메일 계정 관리">
              <span className="nav-icon">📬</span><span className="nav-label">메일 계정</span>
            </button>
            <button className="nav-item" data-view="tool-crawler" type="button" title="이메일 크롤링">
              <span className="nav-icon">🕷</span><span className="nav-label">이메일 크롤링</span>
            </button>
            <button className="nav-item" data-view="tool-recommended" type="button" title="추천 리스트">
              <span className="nav-icon">💎</span><span className="nav-label">추천 리스트</span>
            </button>
            <button className="nav-item" data-view="tool-import-history" type="button" title="Import History">
              <span className="nav-icon">📋</span><span className="nav-label">Import History</span>
            </button>
          </nav>
        </aside>

        <main className="main">
          <header className="topbar">
            <div>
              <h2 id="viewTitle" className="">Leads</h2>
              <p id="viewSubtitle">Search, qualify, and manage outreach.</p>
            </div>
            <div className="top-actions">
              <button id="addLeadBtn" className="button" type="button">+ 리드 추가</button>
              <button id="importCsvBtn" className="button secondary" type="button">⬆ Import</button>
              <button id="verifyLeadsBtn" className="button secondary" type="button">🔍 검증</button>
              <button id="exportCsvBtn" className="button secondary" type="button">⬇ Export</button>
              <button id="themeToggleBtn" className="theme-toggle" type="button" title="다크/라이트 모드">🌙</button>
              <button id="settingsBtn" className="button secondary" type="button" style={{ display: 'none' }}>설정</button>
              <form action="/api/auth/logout" method="POST" style={{ display: 'inline' }}>
                <button type="submit" className="button ghost">Logout</button>
              </form>
              <button id="markContactedBtn" style={{ display: 'none' }} type="button"></button>
              <button id="undoContactedBtn" style={{ display: 'none' }} type="button"></button>
            </div>
          </header>

          <section className="toolbar" aria-label="Lead filters">
            <label className="search-box">
              <span>Search</span>
              <input id="searchInput" type="search" placeholder="company, country, brand, contact" />
            </label>
            <label>
              <span>Country</span>
              <select id="countryFilter"></select>
            </label>
            <label>
              <span>Status</span>
              <select id="statusFilter"></select>
            </label>
            <label>
              <span>Priority</span>
              <select id="priorityFilter"></select>
            </label>
            <label>
              <span>검증</span>
              <select id="verifyFilter">
                <option value="All">All</option>
                <option value="passed">✅ 통과 (4/4)</option>
                <option value="suspicious">⚠ 의심 (2~3점)</option>
                <option value="invalid">❌ 무효 (0~1점)</option>
                <option value="unverified">⏳ 미검증</option>
              </select>
            </label>
          </section>

          <section id="statsGrid" className="stats-grid" aria-label="Summary"></section>
          <section id="content" className="content"></section>
        </main>
      </div>

      {/* ── Add Lead Modal ── */}
      <div id="addLeadModal" className="modal-backdrop" style={{ display: 'none' }}>
        <div className="modal-card">
          <div className="modal-header">
            <h3>새 바이어 추가</h3>
            <button id="modalCloseBtn" className="modal-close" type="button">&#x2715;</button>
          </div>
          <form id="addLeadForm" className="modal-form">
            <div className="modal-grid">
              <label><span>회사명 (Company) *</span><input id="ml-Company" type="text" placeholder="예: ABC Trading LLC" required /></label>
              <label><span>국가 (Country) *</span><input id="ml-Country" type="text" placeholder="예: UAE" required /></label>
              <label><span>우선순위 (Priority)</span>
                <select id="ml-Priority">
                  <option value="">선택</option>
                  <option value="A-">A- (최우선)</option>
                  <option value="B">B (우선)</option>
                  <option value="C">C (보통)</option>
                </select>
              </label>
              <label><span>유형 (Type)</span><input id="ml-Type" type="text" placeholder="예: Distributor, Retailer" /></label>
              <label><span>바이어 담당자</span><input id="ml-BuyerContact" type="text" placeholder="담당자 이름" /></label>
              <label><span>이메일</span><input id="ml-Email" type="email" placeholder="contact@company.com" /></label>
              <label><span>전화번호</span><input id="ml-Phone" type="text" placeholder="+971 54 000 0000" /></label>
              <label><span>웹사이트</span><input id="ml-WebsiteContact" type="text" placeholder="https://www.example.com" /></label>
              <label className="modal-full"><span>브랜드/채널</span><textarea id="ml-BrandsChannels" placeholder="취급 브랜드나 판매 채널 정보"></textarea></label>
              <label className="modal-full"><span>메모</span><textarea id="ml-notes" placeholder="첫 연락 계획, 특이사항 등"></textarea></label>
            </div>
            <div className="modal-footer">
              <button type="button" id="modalCancelBtn" className="button ghost">취소</button>
              <button type="submit" id="modalSubmitBtn" className="button">저장하기</button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Edit Lead Modal ── */}
      <div id="editLeadModal" className="modal-backdrop" style={{ display: 'none' }}>
        <div className="modal-card modal-card-wide">
          <div className="modal-header">
            <div>
              <span id="el-badge" className="badge" style={{ marginBottom: '6px', display: 'inline-block' }}></span>
              <h3 id="el-title" style={{ margin: 0 }}>바이어 상세</h3>
              <p id="el-meta" style={{ margin: '4px 0 0', fontSize: '13px', color: '#68726c' }}></p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <button id="el-favoriteBtn" className="favorite-button" type="button">☆ Favorite</button>
              <button id="editModalCloseBtn" className="modal-close" type="button">&#x2715;</button>
            </div>
          </div>

          <div className="modal-form">
            {/* Action buttons */}
            <div className="el-actions" id="el-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
              <a id="el-website" href="#" target="_blank" rel="noreferrer" className="button ghost" style={{ display: 'none' }}>Website</a>
              <a id="el-linkedin" href="#" target="_blank" rel="noreferrer" className="button ghost" style={{ display: 'none' }}>LinkedIn</a>
              <a id="el-email-btn" href="#" className="button ghost" style={{ display: 'none' }}>Email</a>
              <a id="el-phone-btn" href="#" className="button ghost" style={{ display: 'none' }}>Call</a>
              <button id="el-deleteBtn" className="button ghost" style={{ color: '#9f3333', borderColor: '#9f3333' }} type="button">Delete</button>
            </div>

            <div className="modal-grid modal-grid-3col">
              {/* CRM 관리 필드 */}
              <label><span>Status</span>
                <select id="el-status">
                  {['New', 'Qualified', 'Contacted', 'Sample Sent', 'Negotiating', 'Won', 'Lost'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label><span>Owner (담당자)</span><input id="el-owner" type="text" placeholder="담당자" /></label>
              <label><span>Last Contact</span><input id="el-lastContact" type="date" /></label>
              <label><span>Next Follow-up</span><input id="el-nextFollowUp" type="date" /></label>
              <label className="modal-full"><span>Notes</span><textarea id="el-notes" placeholder="통화 내용, 샘플 발송, 가격 조건 등"></textarea></label>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #dce3dd', margin: '16px 0' }} />
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#68726c', margin: '0 0 12px' }}>Lead Data</p>

            <div className="modal-grid">
              <label><span>Company</span><input id="el-Company" type="text" /></label>
              <label><span>Country</span><input id="el-Country" type="text" /></label>
              <label><span>Priority</span><input id="el-Priority" type="text" /></label>
              <label><span>Type</span><input id="el-Type" type="text" /></label>
              <label><span>Buyer Name</span><input id="el-BuyerContact" type="text" /></label>
              <label><span>Title</span><input id="el-Title" type="text" /></label>
              <label><span>Email</span><input id="el-Email" type="text" /></label>
              <label><span>Phone</span><input id="el-Phone" type="text" /></label>
              <label><span>Website</span><input id="el-WebsiteContact" type="text" /></label>
              <label><span>LinkedIn Company</span><input id="el-LinkedInCompany" type="text" /></label>
              <label className="modal-full"><span>Brands / Channels</span><textarea id="el-BrandsChannels"></textarea></label>
              <label className="modal-full"><span>Evidence</span><textarea id="el-Evidence"></textarea></label>
              <label className="modal-full"><span>Approach</span><textarea id="el-Approach"></textarea></label>
              <label className="modal-full"><span>Sources</span><textarea id="el-Sources"></textarea></label>
            </div>

            {/* 자동 검증 결과 — 항목별 실패 사유까지 표시 */}
            <div className="field-block" style={{ marginTop: '16px' }}>
              <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>🔍 자동 검증 결과</h4>
              <div id="el-verification"></div>
            </div>

            <div className="modal-footer" style={{ marginTop: '20px' }}>
              <button type="button" id="editModalCloseBtn2" className="button">저장 및 닫기</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Import CSV Modal ── */}
      <div id="importCsvModal" className="modal-backdrop" style={{ display: 'none' }}>
        <div className="modal-card" style={{ maxWidth: '720px', width: '95vw' }}>
          <div className="modal-header">
            <h3>CSV 가져오기 (Import CSV)</h3>
            <button id="importModalCloseBtn" className="modal-close" type="button">&#x2715;</button>
          </div>
          <div className="modal-form">

            {/* Step 1: File select */}
            <div id="importStep1">
              <p style={{ marginBottom: '8px', color: 'var(--muted)', fontSize: '14px' }}>
                CSV 파일을 선택하면 미리보기와 함께 가져올 수 있습니다.<br />
                <strong>필수 컬럼:</strong> Company, Country &nbsp;|&nbsp;
                <strong>선택 컬럼:</strong> Priority, Type, BuyerContact, Email, Phone, WebsiteContact, BrandsChannels, Notes, Status
              </p>
              <div style={{
                marginBottom: '14px', padding: '10px 14px',
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                border: '1px solid #93c5fd', borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
              }}>
                <div style={{ fontSize: '13px', color: '#1e3a8a' }}>
                  <b>📋 처음이신가요?</b> 예제 양식을 다운받아 채워서 업로드하세요.<br/>
                  <span style={{ fontSize: '11px', color: '#3730a3' }}>모든 컬럼 예시 · 3개 샘플 리드 포함 · UTF-8</span>
                </div>
                <button type="button" id="downloadSampleCsvBtn" style={{
                  padding: '8px 14px', fontSize: '12px', fontWeight: 700,
                  background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}>⬇ 예제 양식 다운로드</button>
              </div>

              <div
                id="importDropZone"
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: '10px',
                  padding: '36px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color .2s, background .2s',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>📂</div>
                <p style={{ margin: 0, fontWeight: 600 }}>CSV 파일을 여기에 드래그하거나 클릭하여 선택</p>
                <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '13px' }}>UTF-8 인코딩 권장 · 최대 5MB</p>
                <input id="importFileInput" type="file" accept=".csv,text/csv" style={{ display: 'none' }} />
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                <label style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap' }}>중복 처리:</label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  <input type="radio" name="duplicateAction" value="skip" defaultChecked />
                  <span>건너뛰기 (Skip)</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  <input type="radio" name="duplicateAction" value="overwrite" />
                  <span>덮어쓰기 (Overwrite)</span>
                </label>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                * 중복 기준: Company + Country 동일
              </p>
            </div>

            {/* Step 2: Preview */}
            <div id="importStep2" style={{ display: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p id="importPreviewInfo" style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}></p>
                <button id="importResetBtn" className="button ghost" type="button" style={{ fontSize: '13px', padding: '4px 12px' }}>다시 선택</button>
              </div>
              <div className="table-wrap" style={{ maxHeight: '280px', minHeight: 'auto', marginBottom: '16px' }}>
                <table id="importPreviewTable">
                  <thead id="importPreviewHead"></thead>
                  <tbody id="importPreviewBody"></tbody>
                </table>
              </div>
            </div>

            {/* Progress */}
            <div id="importProgress" style={{ display: 'none', marginBottom: '12px' }}>
              <div style={{ background: 'var(--border)', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                <div id="importProgressBar" style={{ height: '100%', background: 'var(--accent)', width: '0%', transition: 'width .3s' }}></div>
              </div>
              <p id="importProgressText" style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--muted)' }}>처리 중...</p>
            </div>

            {/* Result */}
            <div id="importResult" style={{ display: 'none', padding: '12px 16px', borderRadius: '8px', background: '#f0faf5', border: '1px solid #b8e0cd', marginBottom: '12px' }}>
              <p id="importResultText" style={{ margin: 0, fontSize: '14px' }}></p>
            </div>

          </div>
          <div className="modal-footer">
            <button type="button" id="importCancelBtn" className="button ghost">취소</button>
            <button type="button" id="importSubmitBtn" className="button" disabled>가져오기</button>
          </div>
        </div>
      </div>

      {/* ── Verify Modal ── */}
      <div id="verifyModal" className="modal-backdrop" style={{ display: 'none' }}>
        <div className="modal-card" style={{ maxWidth: '560px' }}>
          <div className="modal-header">
            <h3>🔍 리드 자동 검증</h3>
            <button id="verifyCloseBtn" className="modal-close" type="button">&#x2715;</button>
          </div>
          <div className="modal-form">
            <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--muted)' }}>
              이메일(MX) · 웹사이트(HTTP) · 전화(국가코드) · LinkedIn(형식) · <strong style={{ color: '#0369a1' }}>K-beauty 사업관련성</strong> 5가지를 확인합니다.
            </p>

            {/* 검증 방법 안내 (펼치기/접기) */}
            <details style={{
              marginBottom: '14px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              background: '#f0f9ff',
              padding: '10px 14px',
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '13px', color: '#0369a1', listStyle: 'revert' }}>
                ℹ️ 검증 방법 자세히 보기
              </summary>
              <div style={{ marginTop: '12px', fontSize: '12.5px', lineHeight: 1.7, color: '#374151' }}>
                <p style={{ margin: '0 0 10px' }}>
                  <strong>1. 이메일 검증</strong><br />
                  · 문법 검사 (예: <code>abc@xxx,com</code>같은 콤마 오타 잡음)<br />
                  · 도메인이 <strong>메일을 받을 수 있는지 DNS 조회</strong> (MX 레코드)<br />
                  · 일회용 메일(mailinator 등) 블랙리스트 차단
                </p>
                <p style={{ margin: '0 0 10px' }}>
                  <strong>2. 웹사이트 검증</strong><br />
                  · 실제 사이트에 <strong>HEAD 요청</strong>을 보내 6초 안에 200~399 응답이 오는지 확인<br />
                  · 도메인 만료, DNS 실패, 404, 5xx 모두 실패로 분류
                </p>
                <p style={{ margin: '0 0 10px' }}>
                  <strong>3. 전화번호 검증</strong><br />
                  · 입력된 번호의 <strong>국가코드가 Country 컬럼과 일치하는지</strong> 비교<br />
                  · 예: Country=UAE 인데 번호가 +82(한국) → 불일치
                </p>
                <p style={{ margin: '0 0 10px' }}>
                  <strong>4. LinkedIn URL 검증</strong><br />
                  · <code>linkedin.com/in/...</code> 또는 <code>/company/...</code> 표준 형식인지 검사
                </p>
                <p style={{ margin: '0 0 10px' }}>
                  <strong>5. K-beauty 사업관련성 검증</strong><br />
                  · 회사 웹사이트 본문(최대 600KB) 다운로드 후 텍스트 추출<br />
                  · 영어/한국어 <strong>뷰티·화장품 키워드 사전</strong>으로 매칭<br />
                  &nbsp;&nbsp;&nbsp;(beauty, cosmetics, skincare, K-beauty, 뷰티, 화장품, 코스메틱 등)<br />
                  · 디스트리뷰터·도매 시그널 가중치 + 무관 산업(부동산·금융 등) 감점<br />
                  · 3점: K-beauty 직결 / 2점: 일반 뷰티 다수 / 1점: 약함 / 0점: 무관
                </p>
                <p style={{ margin: '0 0 6px', padding: '8px 10px', background: '#fff', borderRadius: '6px', borderLeft: '3px solid #f59e0b' }}>
                  <strong style={{ color: '#92400e' }}>종합 점수:</strong> 4개 정합성 항목 + 사업관련성(2점 이상 시 1점) = 최대 5점<br />
                  <span style={{ color: '#166534' }}>5점</span> 통과 / <span style={{ color: '#92400e' }}>3~4점</span> 의심 / <span style={{ color: '#991b1b' }}>0~2점</span> 무효
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: '#6b7280' }}>
                  ※ 외부 유료 API 없이 자체 서버에서 무료로 동작. 검증 1회당 비용 $0.<br />
                  ※ 점수가 낮다고 "그 업체가 가짜"라는 뜻은 아님 — 입력 데이터에 빈칸/오타가 있거나 정보가 불완전하다는 신호로 사용.
                </p>
              </div>
            </details>

            <div id="verifySummary" style={{
              background: '#f8fafc', padding: '12px 14px', borderRadius: '8px',
              marginBottom: '14px', fontSize: '13px', lineHeight: 1.6,
            }}>
              <div>전체 리드: <strong id="verifyTotalCount">-</strong></div>
              <div>미검증: <strong id="verifyPendingCount">-</strong></div>
              <div>검증완료: <strong id="verifyDoneCount">-</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                <input type="radio" name="verifyScope" value="pending" defaultChecked />
                <span>미검증 항목만</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                <input type="radio" name="verifyScope" value="all" />
                <span>전체 다시 검증</span>
              </label>
            </div>

            <div id="verifyProgress" style={{ display: 'none', marginBottom: '14px' }}>
              <div style={{ background: '#e5e7eb', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                <div id="verifyProgressBar" style={{ background: 'linear-gradient(90deg, #4f8cff, #7c4dff)', height: '100%', width: '0%', transition: 'width 0.3s' }}></div>
              </div>
              <div id="verifyProgressText" style={{ marginTop: '8px', fontSize: '13px', color: 'var(--muted)' }}>0/0 처리 중...</div>
            </div>

            <div id="verifyResult" style={{ display: 'none', background: '#e8f5e9', border: '1px solid #a5d6a7', padding: '12px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px', lineHeight: 1.6 }}>
              <div id="verifyResultText"></div>
            </div>

            {/* AI 정밀 검증 (Claude API) — 룰 기반 검증 위에 얹는 2차 검증 */}
            <div style={{
              marginTop: '14px',
              padding: '12px 14px',
              border: '1px solid #c7d2fe',
              borderRadius: '8px',
              background: '#eef2ff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '16px' }}>🧠</span>
                <strong style={{ fontSize: '13px', color: '#3730a3' }}>AI 정밀 검증 (Claude API)</strong>
                <span style={{ fontSize: '10px', color: '#6366f1', background: '#fff', padding: '2px 6px', borderRadius: '99px', border: '1px solid #c7d2fe' }}>Haiku 4.5</span>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#4338ca', lineHeight: 1.5 }}>
                룰 기반 검증이 끝난 <strong>의심 (3~4점)</strong> 케이스를 LLM이 한 번 더 판단합니다.
                회사명/사이트 메타/우리 메모를 종합해 <code>beauty-buyer</code> / <code>maybe</code> / <code>not-buyer</code>로 분류 + 한국어 근거 제공.
              </p>
              <div id="verifyAISummary" style={{
                fontSize: '12px', color: '#1e1b4b', background: '#fff', padding: '8px 10px', borderRadius: '6px', marginBottom: '8px',
              }}>
                <div>의심 미검증 대상: <strong id="verifyAITargetCount">-</strong>건</div>
                <div>예상 비용: <strong id="verifyAICostEstimate">-</strong> (건당 약 $0.0005)</div>
              </div>
              <div id="verifyAIProgress" style={{ display: 'none', marginBottom: '8px' }}>
                <div style={{ background: '#e5e7eb', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                  <div id="verifyAIProgressBar" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', height: '100%', width: '0%', transition: 'width 0.3s' }}></div>
                </div>
                <div id="verifyAIProgressText" style={{ marginTop: '6px', fontSize: '12px', color: '#6366f1' }}>0/0 처리 중...</div>
              </div>
              <div id="verifyAIResult" style={{ display: 'none', fontSize: '12px', color: '#1e1b4b', padding: '8px 10px', background: '#fff', border: '1px solid #c7d2fe', borderRadius: '6px', marginBottom: '8px' }}></div>
              <button id="verifyAIStartBtn" className="button" type="button" style={{
                padding: '7px 14px', fontSize: '12px', fontWeight: 700,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer',
                width: '100%',
              }}>🧠 AI 정밀 검증 시작</button>
            </div>

            <div className="modal-footer">
              <button id="verifyCancelBtn" className="button ghost" type="button">닫기</button>
              <button id="verifyStartBtn" className="button" type="button">검증 시작</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Settings Modal ── */}
      <div id="settingsModal" className="modal-backdrop" style={{ display: 'none' }}>
        <div className="modal-card">
          <div className="modal-header">
            <h3>설정 (Settings)</h3>
            <button id="settingsCloseBtn" className="modal-close" type="button">&#x2715;</button>
          </div>
          <div className="modal-form">

            {/* Password Change Section */}
            <div className="field-block" style={{ borderTop: 'none', paddingTop: 0 }}>
              <h4>비밀번호 변경 (Change Password)</h4>
              <p style={{ marginBottom: '12px', color: 'var(--muted)' }}>현재 로그인된 계정의 비밀번호를 변경합니다.</p>
              <div className="inline-save">
                <input id="newPasswordInput" type="password" placeholder="새 비밀번호 입력" minLength={4} />
                <button id="changePasswordBtn" className="button secondary" type="button">변경하기</button>
              </div>
            </div>

            {/* Sub-ID Management Section (Master Only) */}
            <div id="subIdSection" className="field-block" style={{ display: 'none', marginTop: '24px' }}>
              <h4>서브 계정 관리 (Sub-ID Management)</h4>
              <p style={{ marginBottom: '12px', color: 'var(--muted)' }}>마스터 계정 전용 기능입니다. 서브 계정을 생성하거나 삭제할 수 있습니다.</p>

              <div className="inline-save" style={{ marginBottom: '16px' }}>
                <input id="subUsernameInput" type="text" placeholder="새 아이디" />
                <input id="subPasswordInput" type="password" placeholder="비밀번호" />
                <button id="createSubIdBtn" className="button secondary" type="button">생성</button>
              </div>

              <div className="table-wrap" style={{ minHeight: 'auto', maxHeight: '240px' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 'auto' }}>아이디 (Username)</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>생성일</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>삭제</th>
                    </tr>
                  </thead>
                  <tbody id="subIdTableBody">
                    {/* Rows injected via JS */}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Import History Modal ── */}
      <div id="importHistoryModal" className="modal-backdrop" style={{ display: 'none' }}>
        <div className="modal-card" style={{ maxWidth: '680px', width: '95vw' }}>
          <div className="modal-header">
            <h3>Import History (가져오기 기록)</h3>
            <button id="importHistoryCloseBtn" className="modal-close" type="button">&#x2715;</button>
          </div>
          <div className="modal-form">
            <p style={{ marginBottom: '16px', color: 'var(--muted)', fontSize: '14px' }}>
              각 Import 배치를 확인하고 필요하면 <strong>배치 전체 삭제</strong>로 롤백할 수 있습니다.
            </p>
            <div className="table-wrap" style={{ minHeight: 'auto', maxHeight: '400px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Batch ID</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>가져온 날짜</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>건수</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>롤백</th>
                  </tr>
                </thead>
                <tbody id="importHistoryTableBody">
                  {/* Rows injected via JS */}
                </tbody>
              </table>
            </div>
            <div id="importHistoryEmpty" style={{ display: 'none', textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
              <p>아직 CSV Import 기록이 없습니다.</p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" id="importHistoryCloseBtn2" className="button ghost">닫기</button>
          </div>
        </div>
      </div>

      <Script src="/app.js" strategy="afterInteractive" />
    </>
  );
}
