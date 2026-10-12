'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import './login.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.success) {
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || '로그인 실패. 아이디나 비밀번호를 확인해주세요.');
      }
    } catch (err) {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="brand-logo-container">
            <img src="/assets/logo.png" alt="Yogico Logo" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <h2>Yogico CRM</h2>
          <p>Importer & buyer pipeline</p>
        </div>
        
        <form onSubmit={handleLogin}>
          {error && <div className="error-message">{error}</div>}
          
          <div className="input-group">
            {/* 비밀번호를 저장하는 곳은 여기 한 곳이어야 한다 — Chrome 에 로그인 칸임을 알려 준다.
                다른 화면의 비밀번호 칸은 모두 new-password 로 막아 두었다 (page.tsx · app.js). */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              required
              placeholder="마스터 아이디 (ID)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>
          
          <div className="input-group">
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="비밀번호 (Password)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="login-button"
          >
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                로그인 중...
              </>
            ) : (
              '로그인'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
