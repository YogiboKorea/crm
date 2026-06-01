'use client';

import Script from 'next/script';

export default function Home() {
  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <button id="homeBtn" className="brand" type="button" aria-label="Reset filters and go to Leads">
            <div className="brand-mark">
              <img src="/assets/logo.png" alt="Yogico" className="brand-logo"
                onError={(e) => { (e.target as HTMLImageElement).src = '/assets/logo.png'; }} />
            </div>
            <div>
              <h1>Yogico CRM</h1>
              <p>Importer &amp; buyer pipeline</p>
            </div>
          </button>
          <nav className="nav" aria-label="Views">
            <button className="nav-item active" data-view="leads" type="button">Leads</button>
            <button className="nav-item" data-view="leads" data-status-filter="New" type="button">New</button>
            <button className="nav-item" data-view="leads" data-status-filter="Contacted" type="button">Contacted</button>
            <button className="nav-item" data-view="favorites" type="button">Favorites</button>
            <button className="nav-item" data-view="countries" type="button">Countries</button>
            <button className="nav-item" data-view="emails" type="button">Missing Emails</button>
            <button className="nav-item" data-view="followups" type="button">Follow-ups</button>
            <button className="nav-item" data-view="importHistory" type="button">Import History</button>
          </nav>
        </aside>

        <main className="main">
          <header className="topbar">
            <div>
              <h2 id="viewTitle" className="">Leads</h2>
              <p id="viewSubtitle">Search, qualify, and manage outreach.</p>
            </div>
            <div className="top-actions">
              <button id="addLeadBtn" className="button" type="button">+ Add Lead</button>
              <button id="markContactedBtn" className="button secondary" type="button">Mark Contacted</button>
              <button id="undoContactedBtn" className="button ghost" type="button">Undo</button>
              <button id="importCsvBtn" className="button secondary" type="button">⬆ Import CSV</button>
              <button id="exportCsvBtn" className="button secondary" type="button">⬇ Export CSV</button>
              <button id="settingsBtn" className="button secondary" type="button" style={{ display: 'none' }}>설정 (Settings)</button>
              <form action="/api/auth/logout" method="POST" style={{ display: 'inline' }}>
                <button type="submit" className="button ghost">Logout</button>
              </form>
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
              <p style={{ marginBottom: '12px', color: 'var(--muted)', fontSize: '14px' }}>
                CSV 파일을 선택하면 미리보기와 함께 가져올 수 있습니다.<br />
                <strong>필수 컬럼:</strong> Company, Country &nbsp;|&nbsp;
                <strong>선택 컬럼:</strong> Priority, Type, BuyerContact, Email, Phone, WebsiteContact, BrandsChannels, Notes, Status
              </p>

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
