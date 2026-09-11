// Cloudflare Pages Functions API: /api/leaderboard
// Kết nối Cloudflare D1 Database binding: env.DB

const responseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Content-Type': 'application/json; charset=utf-8'
};

// Xử lý preflight OPTIONS request
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: responseHeaders
  });
}

// Tự động kiểm tra và khởi tạo bảng leaderboards nếu chưa có
async function ensureLeaderboardsTable(db) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS leaderboards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        player_name TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_leaderboards_game_score 
      ON leaderboards(game_id, score DESC)
    `).run();
  } catch (e) {
    console.error('Error ensuring leaderboards table:', e);
  }
}


// 1. GET: Lấy Top 10 kỷ lục theo game_id và theo tuần/all-time
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const game_id = url.searchParams.get('game_id') || url.searchParams.get('game') || 'jump';
  const type = url.searchParams.get('type') || 'weekly';

  // Fallback nếu chưa kết nối D1 (ví dụ preview môi trường dev local)
  if (!env.DB) {
    const mockResults = [
      { player_name: "Thắng Nhảy Dây", score: 88, created_at: "2026-09-10" },
      { player_name: "Pro_Skipper", score: 75, created_at: "2026-09-09" },
      { player_name: "SpeedHop", score: 64, created_at: "2026-09-08" }
    ];
    return new Response(
      JSON.stringify({
        success: true,
        game_id,
        type,
        results: mockResults,
        top10: mockResults.map((r, idx) => ({ ...r, rank: idx + 1, display_name: r.player_name }))
      }),
      { status: 200, headers: responseHeaders }
    );
  }

  try {
    await ensureLeaderboardsTable(env.DB);

    let query = '';
    let params = [game_id];

    // Lọc theo tuần (7 ngày gần nhất) hoặc all-time, mỗi player chỉ lấy điểm cao nhất
    if (type === 'weekly') {
      query = `
        SELECT player_name, MAX(score) as score, MAX(created_at) as created_at 
        FROM leaderboards 
        WHERE game_id = ? AND created_at >= datetime('now', '-7 days') 
        GROUP BY player_name 
        ORDER BY score DESC LIMIT 10
      `;
    } else {
      // type === 'alltime' hoặc các giá trị khác
      query = `
        SELECT player_name, MAX(score) as score, MAX(created_at) as created_at 
        FROM leaderboards 
        WHERE game_id = ? 
        GROUP BY player_name 
        ORDER BY score DESC LIMIT 10
      `;
    }

    const { results } = await env.DB.prepare(query).bind(...params).all();
    const rows = results || [];

    // Chuẩn hoá top10 cho frontend
    const top10 = rows.map((row, idx) => ({
      rank: idx + 1,
      player_name: row.player_name,
      display_name: row.player_name,
      score: Number(row.score),
      created_at: row.created_at
    }));

    return new Response(
      JSON.stringify({
        success: true,
        game_id,
        type,
        results: top10,
        top10,
        min_qualifying_score: top10.length < 10 ? 1 : top10[top10.length - 1].score
      }),
      {
        status: 200,
        headers: responseHeaders
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi truy vấn Database' }),
      { status: 500, headers: responseHeaders }
    );
  }
}

// 2. POST: Lưu điểm kỷ lục mới khi người chơi kết thúc game
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const game_id = body.game_id || body.game;
    const player_name = (body.player_name || body.display_name || '').trim();
    const score = Number(body.score);

    // Kiểm tra hợp lệ: player_name không rỗng, score > 0
    if (!player_name || player_name.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tên người chơi không được để trống' }),
        { status: 400, headers: responseHeaders }
      );
    }

    if (isNaN(score) || score <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Điểm số phải lớn hơn 0' }),
        { status: 400, headers: responseHeaders }
      );
    }

    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: true, message: 'Đã lưu điểm (mock mode)' }),
        { status: 200, headers: responseHeaders }
      );
    }

    await ensureLeaderboardsTable(env.DB);

    // Insert vào D1
    await env.DB.prepare("INSERT INTO leaderboards (game_id, player_name, score) VALUES (?, ?, ?)")
      .bind(game_id, player_name.trim(), score)
      .run();

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: responseHeaders
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi server xử lý lưu điểm' }),
      { status: 500, headers: responseHeaders }
    );
  }
}
