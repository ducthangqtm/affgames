// Cloudflare Pages Functions API: /api/stats
// Quản lý biến tổng total_plays trong bảng game_stats (cột key, value) trên Cloudflare D1

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate'
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

// GET: Lấy số hiển thị khi F5/vào web
export async function onRequestGet(context) {
  const { env } = context;

  if (!env.DB) {
    return Response.json({ total_plays: 65 }, { headers: corsHeaders });
  }

  try {
    const row = await env.DB.prepare("SELECT value FROM game_stats WHERE key = 'total_plays'").first();
    return Response.json(
      { total_plays: row ? Number(row.value) : 0 },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error('Lỗi GET /api/stats:', err);
    return Response.json(
      { error: err.message, total_plays: 0 },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST: Tăng lượt chơi khi bấm Chơi Ngay
export async function onRequestPost(context) {
  const { env } = context;

  if (!env.DB) {
    return Response.json({ success: true, total_plays: 66 }, { headers: corsHeaders });
  }

  try {
    await env.DB.prepare(`
      INSERT INTO game_stats (key, value) VALUES ('total_plays', 1)
      ON CONFLICT(key) DO UPDATE SET value = value + 1
    `).run();

    const row = await env.DB.prepare("SELECT value FROM game_stats WHERE key = 'total_plays'").first();
    return Response.json(
      { success: true, total_plays: row ? Number(row.value) : 0 },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error('Lỗi POST /api/stats:', err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
