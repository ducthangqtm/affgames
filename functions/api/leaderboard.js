// Cloudflare Pages Functions API: /api/leaderboard
// Kết nối Cloudflare D1 Database binding: env.DB

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8'
};

// Xử lý preflight CORS request
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

// Lấy mốc thời gian bắt đầu tuần hiện tại (00:00:00 Thứ 2 theo giờ Việt Nam UTC+7)
function getStartOfWeekISO() {
  const now = new Date();
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = vnTime.getUTCDay(); // 0: CN, 1: T2...
  const diff = day === 0 ? 6 : day - 1;
  const mondayVN = new Date(vnTime);
  mondayVN.setUTCDate(vnTime.getUTCDate() - diff);
  mondayVN.setUTCHours(0, 0, 0, 0);
  const mondayUTC = new Date(mondayVN.getTime() - 7 * 60 * 60 * 1000);
  return mondayUTC.toISOString().replace('T', ' ').substring(0, 19);
}

// Đảm bảo bảng leaderboards tồn tại trong D1
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
    console.error('Error ensuring table:', e);
  }
}

// GET: Lấy Top 10 kỷ lục theo game_id (jump, snake, tetris, 2048) và theo tuần/all-time
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const gameId = url.searchParams.get('game_id') || url.searchParams.get('game') || 'jump';
  const type = url.searchParams.get('type') || 'all_time'; // 'weekly' | 'all_time' | 'admin_weekly'
  const isJump = gameId === 'jump';

  // Fallback dữ liệu mẫu khi chưa kết nối D1 (local preview / testing)
  if (!env.DB) {
    const mockList = [
      { rank: 1, player_name: "Pro_Skipper", display_name: "Pro_Skipper", score: 95, created_at: "2026-09-08" },
      { rank: 2, player_name: "Thắng Nhảy Dây", display_name: "Thắng Nhảy Dây", score: 88, created_at: "2026-09-09" },
      { rank: 3, player_name: "SpeedHop", display_name: "SpeedHop", score: 64, created_at: "2026-09-10" },
      { rank: 4, player_name: "HànhLangMaster", display_name: "HànhLangMaster", score: 52, created_at: "2026-09-08" },
      { rank: 5, player_name: "MinhNhảy", display_name: "MinhNhảy", score: 41, created_at: "2026-09-09" }
    ];
    return new Response(
      JSON.stringify({
        success: true,
        game_id: gameId,
        type: type,
        top10: mockList,
        min_qualifying_score: 1,
        notice: "Running in mock mode (D1 DB not bound)"
      }),
      { headers: corsHeaders }
    );
  }

  try {
    await ensureLeaderboardsTable(env.DB);

    let query = '';
    let params = [];

    if (type === 'weekly' && isJump) {
      const startOfWeek = getStartOfWeekISO();
      query = `
        SELECT player_name, score, created_at 
        FROM leaderboards 
        WHERE game_id = ? AND created_at >= ?
        ORDER BY score DESC 
        LIMIT 10
      `;
      params = [gameId, startOfWeek];
    } else {
      // All-time hoặc game khác
      query = `
        SELECT player_name, score, created_at 
        FROM leaderboards 
        WHERE game_id = ? 
        ORDER BY score DESC 
        LIMIT 10
      `;
      params = [gameId];
    }

    const res = await env.DB.prepare(query).bind(...params).all();
    const rows = res.results || [];

    const top10 = rows.map((row, idx) => ({
      rank: idx + 1,
      player_name: row.player_name,
      display_name: row.player_name, // Đồng bộ cả 2 field cho frontend
      score: Number(row.score),
      created_at: row.created_at
    }));

    const minQualifyingScore = top10.length < 10 ? 1 : top10[top10.length - 1].score;

    return new Response(
      JSON.stringify({
        success: true,
        game_id: gameId,
        type: type,
        top10,
        min_qualifying_score: minQualifyingScore,
        count: top10.length
      }),
      { headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi truy vấn Database' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST: Lưu điểm kỷ lục mới khi người chơi kết thúc game
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const game_id = body.game_id || body.game;
    const player_name = (body.player_name || body.display_name || '').trim();
    const score = Number(body.score);

    // Validate đầu vào
    const validGames = ['jump', 'snake', '2048', 'tetris'];
    if (!game_id || !validGames.includes(game_id)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mã game không hợp lệ (hỗ trợ: jump, snake, 2048, tetris)' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!player_name || player_name.length < 2 || player_name.length > 30) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tên người chơi phải từ 2 đến 30 ký tự' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (isNaN(score) || score <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Điểm số phải là số lớn hơn 0' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Fallback nếu chưa kết nối D1
    if (!env.DB) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Lưu điểm thành công (Môi trường test)',
          data: { game_id, player_name, score }
        }),
        { headers: corsHeaders }
      );
    }

    await ensureLeaderboardsTable(env.DB);

    // Insert vào D1
    const query = `INSERT INTO leaderboards (game_id, player_name, score) VALUES (?, ?, ?)`;
    await env.DB.prepare(query).bind(game_id, player_name, score).run();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Lưu điểm kỷ lục mới thành công!',
        data: {
          game_id,
          player_name,
          score
        }
      }),
      { status: 201, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi server xử lý điểm' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
