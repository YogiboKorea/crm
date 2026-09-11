import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'MONGODB_URI 환경변수가 설정되지 않았습니다. ' +
    '로컬: .env.local 파일 / Vercel: Project Settings → Environment Variables에 추가하세요.'
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    // ── 서버리스에 맞춘 연결 설정 ──
    //
    // Vercel 은 요청마다 함수가 깨어난다. 한동안 요청이 없으면 통째로 잠들고
    // (콜드 스타트), 그때 DB 연결을 처음부터 다시 맺는다. 기본값 그대로 두면
    // 그 한 번이 몇 초까지 늘어져서 "서버가 로컬보다 느리다" 로 나타난다.
    const opts = {
      bufferCommands: false,

      // 함수 하나가 동시에 처리하는 요청은 많아야 몇 개다. 풀을 크게 잡으면
      // 깨어날 때마다 소켓을 그만큼 새로 여느라 콜드 스타트가 길어진다.
      maxPoolSize: 10,
      minPoolSize: 0,

      // 서버를 못 찾을 때 30초(기본값)를 기다리면 화면이 멈춘 것처럼 보인다.
      // 어차피 실패할 것이면 빨리 알려주고 다시 시도하는 편이 낫다.
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 45000,

      // 잠깐 끊겼을 때 드라이버가 알아서 한 번 더 시도한다.
      // 서버리스에서는 소켓이 조용히 끊기는 일이 잦다.
      retryWrites: true,
      retryReads: true,

      // 압축 — 목록 응답이 수백 KB 라 전송량이 준다.
      // zlib 만 쓴다. zstd·snappy 가 더 빠르지만 별도 패키지가 필요하고,
      // 없는 상태로 적어두면 연결 자체가 실패한다 (설치돼 있지 않다).
      compressors: ['zlib'] as any,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
