// Cloudflare Pages Functions API: /api/leaderboard
// Kết nối Cloudflare D1 Database binding: env.DB

interface Env {
  DB: D1Database;
}

interface PlayerRecord {
  id: number;
  display_name: string;
  normalized_name: string;
  pin_hash: string;
  contact_info?: string;
  created_at: string;
}

interface ScoreRow {
  player_id?: number;
  display_name: string;
  score: number;
  updated_at: string;
  contact_info?: string;
  pin_hash?: string;
}

// Hash PIN bằng SHA-256 qua Web Crypto API
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

// Tính mốc 00:00:00 Thứ Hai đầu tuần hiện tại theo giờ Việt Nam (UTC+7)
function getStartOfWeekISO(): string {
  const now = new Date();
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = vnTime.getUTCDay(); // 0: Chủ nhật, 1: Thứ 2, ...
  const diff = day === 0 ? 6 : day - 1; // Số ngày từ Thứ 2
  const mondayVN = new Date(vnTime);
  mondayVN.setUTCDate(vnTime.getUTCDate() - diff);
  mondayVN.setUTCHours(0, 0, 0, 0);
  const mondayUTC = new Date(mondayVN.getTime() - 7 * 60 * 60 * 1000);
  return mondayUTC.toISOString().replace('T', ' ').substring(0, 19);
}

// Trả về mã tuần ISO: YYYY-Www (theo giờ VN UTC+7)
function getISOWeekId(d = new Date()): string {
  const vnDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const target = new Date(vnDate.valueOf());
  const dayNr = (vnDate.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = new Date(firstThursday).getUTCFullYear();
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

// Trả về mã tuần trước đó
function getPreviousWeekId(currentWeekId: string): string {
  const parts = currentWeekId.split('-W');
  const year = parseInt(parts[0], 10);
  const week = parseInt(parts[1], 10);
  if (week > 1) {
    return `${year}-W${String(week - 1).padStart(2, '0')}`;
  } else {
    return `${year - 1}-W52`;
  }
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const url = new URL(request.url);
  const gameId = url.searchParams.get('game') || 'jump';
  const typeParam = url.searchParams.get('type') || 'weekly';
  const currentWeekId = getISOWeekId();
  const prevWeekId = getPreviousWeekId(currentWeekId);
  const targetWeekId = url.searchParams.get('week_id') || currentWeekId;

  // CHỈ áp dụng chế độ "Đua Top Tuần" cho duy nhất trò "Thắng Nhảy Dây" (jump)
  const isJump = gameId === 'jump';
  const effectiveType = isJump ? typeParam : 'all_time';

  // Fallback nếu chưa kết nối D1 (ví dụ môi trường preview/test chưa bind)
  if (!env.DB) {
    if (effectiveType === 'admin_weekly') {
      const demoHash1234 = await hashPin('1234');
      return new Response(
        JSON.stringify({
          success: true,
          game_id: 'jump',
          type: 'admin_weekly',
          week_id: targetWeekId,
          top10: [
            { rank: 1, display_name: "Pro_Skipper", score: 95, contact_info: "0912345678", pin_hash: demoHash1234, updated_at: "2026-09-08" },
            { rank: 2, display_name: "Thắng Nhảy Dây", score: 88, contact_info: "0988776655", pin_hash: demoHash1234, updated_at: "2026-09-09" },
            { rank: 3, display_name: "SpeedHop", score: 64, contact_info: "0901234567", pin_hash: demoHash1234, updated_at: "2026-09-10" }
          ]
        }),
        { headers: corsHeaders }
      );
    }

    const isWeekly = effectiveType === 'weekly';
    const mockList = isWeekly ? [
      { rank: 1, display_name: "Pro_Skipper", score: 95, updated_at: "2026-09-08" },
      { rank: 2, display_name: "Thắng Nhảy Dây", score: 88, updated_at: "2026-09-09" },
      { rank: 3, display_name: "SpeedHop", score: 64, updated_at: "2026-09-10" },
      { rank: 4, display_name: "HànhLangMaster", score: 52, updated_at: "2026-09-08" },
      { rank: 5, display_name: "MinhNhảy", score: 41, updated_at: "2026-09-09" }
    ] : [
      { rank: 1, display_name: "Thắng Nhảy Dây", score: 108, updated_at: "2026-09-01" },
      { rank: 2, display_name: "Pro_Skipper", score: 95, updated_at: "2026-09-02" },
      { rank: 3, display_name: "HànhLangMaster", score: 72, updated_at: "2026-09-03" }
    ];

    return new Response(
      JSON.stringify({
        success: true,
        game_id: gameId,
        type: effectiveType,
        week_id: currentWeekId,
        last_week_winner: isJump ? {
          display_name: "Hoàng_Jump_99",
          score: 98,
          week_id: prevWeekId
        } : null,
        top10: mockList,
        min_qualifying_score: 1,
        notice: "Running in mock mode (D1 DB not bound)"
      }),
      { headers: corsHeaders }
    );
  }

  try {
    // 1. Phân hệ Admin Trao Giải Đua Top Tuần
    if (effectiveType === 'admin_weekly') {
      const query = `
        SELECT p.id as player_id, p.display_name, p.contact_info, p.pin_hash,
               MAX(s.score) as score, MAX(s.updated_at) as updated_at
        FROM game_scores s
        JOIN players p ON s.player_id = p.id
        WHERE s.game_id = 'jump' AND s.week_id = ?
        GROUP BY s.player_id
        ORDER BY score DESC, updated_at ASC
        LIMIT 10
      `;
      const res = await env.DB.prepare(query).bind(targetWeekId).all<ScoreRow>();
      const top10 = (res.results || []).map((row, idx) => ({
        rank: idx + 1,
        player_id: row.player_id,
        display_name: row.display_name,
        contact_info: row.contact_info || '',
        pin_hash: row.pin_hash || '',
        score: row.score,
        updated_at: row.updated_at
      }));

      return new Response(
        JSON.stringify({
          success: true,
          game_id: 'jump',
          type: 'admin_weekly',
          week_id: targetWeekId,
          top10
        }),
        { headers: corsHeaders }
      );
    }

    // 2. Chế độ Public GET Bảng Vàng (Bảo mật: TUYỆT ĐỐI KHÔNG trả contact_info hay pin_hash)
    let query: string;
    let results: ScoreRow[] = [];
    let lastWeekWinner: { display_name: string; score: number; week_id: string } | null = null;

    if (effectiveType === 'weekly' && isJump) {
      const startOfWeek = getStartOfWeekISO();
      query = `
        SELECT p.display_name, MAX(s.score) as score, MAX(s.updated_at) as updated_at
        FROM game_scores s
        JOIN players p ON s.player_id = p.id
        WHERE s.game_id = 'jump' AND (s.week_id = ? OR s.updated_at >= ?)
        GROUP BY s.player_id
        ORDER BY score DESC, updated_at ASC
        LIMIT 10
      `;
      const res = await env.DB.prepare(query).bind(currentWeekId, startOfWeek).all<ScoreRow>();
      results = res.results || [];

      // Lấy Quán quân tuần trước
      try {
        const prevWinnerQuery = `
          SELECT p.display_name, MAX(s.score) as score
          FROM game_scores s
          JOIN players p ON s.player_id = p.id
          WHERE s.game_id = 'jump' AND s.week_id = ?
          GROUP BY s.player_id
          ORDER BY score DESC
          LIMIT 1
        `;
        const prevWinnerRes = await env.DB.prepare(prevWinnerQuery).bind(prevWeekId).first<{ display_name: string; score: number }>();
        if (prevWinnerRes) {
          lastWeekWinner = {
            display_name: prevWinnerRes.display_name,
            score: prevWinnerRes.score,
            week_id: prevWeekId
          };
        } else {
          lastWeekWinner = {
            display_name: "Hoàng_Jump_99",
            score: 98,
            week_id: prevWeekId
          };
        }
      } catch (e) {
        lastWeekWinner = {
          display_name: "Hoàng_Jump_99",
          score: 98,
          week_id: prevWeekId
        };
      }
    } else {
      // All-Time Leaderboard
      query = `
        SELECT p.display_name, MAX(s.score) as score, MAX(s.updated_at) as updated_at
        FROM game_scores s
        JOIN players p ON s.player_id = p.id
        WHERE s.game_id = ?
        GROUP BY s.player_id
        ORDER BY score DESC, updated_at ASC
        LIMIT 10
      `;
      const res = await env.DB.prepare(query).bind(gameId).all<ScoreRow>();
      results = res.results || [];
    }

    const top10 = results.map((row, index) => ({
      rank: index + 1,
      display_name: row.display_name,
      score: row.score,
      updated_at: row.updated_at
    }));

    const minQualifyingScore = top10.length < 10 ? 1 : top10[top10.length - 1].score;

    return new Response(
      JSON.stringify({
        success: true,
        game_id: gameId,
        type: effectiveType,
        week_id: currentWeekId,
        last_week_winner: lastWeekWinner,
        top10,
        min_qualifying_score: minQualifyingScore,
        count: top10.length
      }),
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Database error' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    const body = await request.json() as {
      game_id?: string;
      score?: number;
      display_name?: string;
      pin?: string;
      contact_info?: string;
    };

    const { game_id, score, display_name, pin, contact_info } = body;

    // Validate đầu vào
    const validGames = ['jump', 'snake', '2048', 'tetris'];
    if (!game_id || !validGames.includes(game_id)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mã game không hợp lệ' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (typeof score !== 'number' || score <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Điểm số không hợp lệ' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!display_name || display_name.trim().length < 2 || display_name.trim().length > 30) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tên người chơi phải từ 2 đến 30 ký tự' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!pin || !/^\d{4,6}$/.test(pin.trim())) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mã PIN phải từ 4 đến 6 chữ số' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const trimmedName = display_name.trim();
    const normalized_name = trimmedName.toLowerCase();
    const pin_hash = await hashPin(pin);
    const cleanContact = (contact_info || '').trim();
    const currentWeekId = getISOWeekId();

    // Fallback nếu chưa kết nối D1
    if (!env.DB) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Lưu điểm thành công (Môi trường test)',
          player: trimmedName,
          score,
          week_id: currentWeekId
        }),
        { headers: corsHeaders }
      );
    }

    // 1. Kiểm tra xem người chơi đã tồn tại theo normalized_name chưa
    const existingPlayer = await env.DB.prepare(
      'SELECT * FROM players WHERE normalized_name = ?'
    ).bind(normalized_name).first<PlayerRecord>();

    let playerId: number;

    if (existingPlayer) {
      // Đã có người dùng này -> Kiểm tra mã PIN
      if (existingPlayer.pin_hash !== pin_hash) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Sai mã PIN cho tên người chơi này! Nếu quên mã PIN, bạn vui lòng tạo một tên khác.'
          }),
          { status: 403, headers: corsHeaders }
        );
      }
      playerId = existingPlayer.id;

      // Cập nhật display_name và contact_info (nếu có cung cấp)
      if (cleanContact) {
        await env.DB.prepare(
          'UPDATE players SET display_name = ?, contact_info = ? WHERE id = ?'
        ).bind(trimmedName, cleanContact, playerId).run();
      } else if (existingPlayer.display_name !== trimmedName) {
        await env.DB.prepare(
          'UPDATE players SET display_name = ? WHERE id = ?'
        ).bind(trimmedName, playerId).run();
      }
    } else {
      // Người chơi mới -> Tạo tài khoản vĩnh viễn kèm contact_info (nếu có)
      const insertPlayer = await env.DB.prepare(
        'INSERT INTO players (display_name, normalized_name, pin_hash, contact_info) VALUES (?, ?, ?, ?)'
      ).bind(trimmedName, normalized_name, pin_hash, cleanContact).run();

      playerId = insertPlayer.meta.last_row_id as number;
    }

    // 2. Ghi điểm kèm week_id của tuần hiện tại
    const existingWeekScore = await env.DB.prepare(
      'SELECT id, score FROM game_scores WHERE player_id = ? AND game_id = ? AND week_id = ?'
    ).bind(playerId, game_id, currentWeekId).first<{ id: number; score: number }>();

    if (existingWeekScore) {
      if (score > existingWeekScore.score) {
        await env.DB.prepare(
          'UPDATE game_scores SET score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(score, existingWeekScore.id).run();
      }
    } else {
      await env.DB.prepare(
        'INSERT INTO game_scores (player_id, game_id, score, week_id) VALUES (?, ?, ?, ?)'
      ).bind(playerId, game_id, score, currentWeekId).run();
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Điểm số của bạn đã được vinh danh trên Bảng Vàng!',
        score,
        week_id: currentWeekId
      }),
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi xử lý server' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

