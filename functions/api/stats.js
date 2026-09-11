// Cloudflare Pages Functions API: /api/stats
// Quản lý biến tổng total_plays trong bảng game_stats trên Cloudflare D1

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8'
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

async function ensureStatsTable(db) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS game_stats (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {
    console.error('Error ensuring game_stats table:', e);
  }
}

// GET /api/stats: Luôn trả về số tổng total_plays để render lên banner ngang
export async function onRequestGet(context) {
  const { env } = context;

  if (!env.DB) {
    return new Response(
      JSON.stringify({ success: true, total_plays: 1250 }),
      { status: 200, headers: corsHeaders }
    );
  }

  try {
    await ensureStatsTable(env.DB);

    const row = await env.DB.prepare(
      "SELECT value FROM game_stats WHERE key = 'total_plays'"
    ).first();

    let total_plays = 0;

    if (row && row.value !== null && row.value !== undefined) {
      total_plays = Number(row.value) || 0;
    } else {
      // Nếu chưa có trong game_stats, khởi tạo từ SELECT COUNT(*) FROM leaderboards
      const countRes = await env.DB.prepare("SELECT COUNT(*) as total FROM leaderboards").first();
      total_plays = countRes ? (Number(countRes.total) || 0) : 0;
      await env.DB.prepare(
        "INSERT INTO game_stats (key, value) VALUES ('total_plays', ?)"
      ).bind(total_plays).run();
    }

    return new Response(
      JSON.stringify({ success: true, total_plays }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi truy vấn stats' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST /api/stats: Tăng total_plays thêm +1 mỗi khi người dùng bấm mở bất kỳ game nào
export async function onRequestPost(context) {
  const { env } = context;

  if (!env.DB) {
    return new Response(
      JSON.stringify({ success: true, message: 'Đã tăng lượt chơi (mock mode)', total_plays: 1251 }),
      { status: 200, headers: corsHeaders }
    );
  }

  try {
    await ensureStatsTable(env.DB);

    // Tăng total_plays theo yêu cầu:
    // INSERT INTO game_stats (key, value) VALUES ('total_plays', (SELECT COUNT(*) FROM leaderboards))
    // ON CONFLICT(key) DO UPDATE SET value = value + 1;
    await env.DB.prepare(`
      INSERT INTO game_stats (key, value) 
      VALUES ('total_plays', (SELECT COUNT(*) FROM leaderboards) + 1)
      ON CONFLICT(key) DO UPDATE SET value = value + 1, updated_at = CURRENT_TIMESTAMP
    `).run();

    const updatedRow = await env.DB.prepare(
      "SELECT value FROM game_stats WHERE key = 'total_plays'"
    ).first();

    const total_plays = updatedRow ? Number(updatedRow.value) : 1;

    return new Response(
      JSON.stringify({ success: true, total_plays }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi cập nhật stats' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
