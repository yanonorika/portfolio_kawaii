// ============================================================
//  作品データ — ここを書き換えるだけで中身を更新できます
//
//  id    :  のファイル名（拡張子なし）
//  type  : "still"（静止画 .webp） / "anim"（アニメ .mp4）
//  cat   : 種別
//  以下は空欄なら表示されません ↓
//  year  : 制作年          例 "2026"
//  tool  : 使用ツール       例 "CLIP STUDIO PAINT"
//  role  : 担当             例 "イラスト・アニメーション"
//  time  : 制作期間         例 "約2週間"
//  song  : 楽曲・原曲など    例 "○○ / ○○"
//  desc  : 作品解説（改行は \n）
//  tags  : タグの配列       例 ["MV", "依頼"]
//
//  ※ 並び順はサイト上でレイヤーをドラッグして入れ替えられます。
//    サイトで決めた並びは「並び順をコピー」で書き出せるので、
//    その配列を ORDER に貼り付けると公開版の初期順になります。
// ============================================================
const WORKS = [
  { id: "butcher-vanity",     title: "BUTCHER VANITY",      type: "still", cat: "MV Illustration" },
  { id: "hachigatsu-no-yoru", title: "八月の夜",             type: "still", cat: "Cover Illustration" },
  { id: "ai-janai",           title: "愛じゃない",           type: "still", cat: "MV Illustration" },
  { id: "ghost-avenue",       title: "ゴーストアベニュー",    type: "still", cat: "MV Illustration" },
  { id: "hide-and-seek",      title: "ハイドアンドシーク",    type: "still", cat: "MV Illustration" },
  { id: "memeshii",           title: "memeしい",             type: "still", cat: "MV Illustration" },
  { id: "owari",              title: "愛に奇術師",            type: "still", cat: "Illustration" },
  { id: "yokubari-buchiko",   title: "よくばり",             type: "still", cat: "MV Illustration" },
  { id: "yokubari3",          title: "よくばり — 01",        type: "still", cat: "MV Illustration" },
  { id: "lost-umbrella",      title: "ロストアンブレラ",      type: "still", cat: "Character Sheet" },
  { id: "butiko",             title: "プロポーズ",               type: "still", cat: "Monochrome" },
  { id: "imawanokiwa",        title: "IMAWANOKIWA",          type: "still", cat: "Cover Illustration" },
  { id: "koi-wa-kitto",       title: "恋はきっと急上昇☆",     type: "still", cat: "Sketch" },
  { id: "pink-twins",         title: "Sketch — pink",        type: "still", cat: "Sketch" },
  { id: "sketch-duo",         title: "Sketch — duo",         type: "still", cat: "Sketch" },
  { id: "okusuri",            title: "おくすり飲んで寝よう",   type: "anim",  cat: "2D Animation" },
  { id: "anim-wind",          title: "みちのままに01",         type: "anim",  cat: "2D Animation" },
  { id: "anim-run",           title: "みちのままに02",         type: "anim",  cat: "2D Animation" },
  { id: "neko",               title: "ねこ",                 type: "anim",  cat: "2D Animation" },
  { id: "sakuga",             title: "自主制作",         type: "anim",  cat: "Animation Rough" },
  { id: "rough-action",       title: "自主制作",       type: "anim",  cat: "Animation Rough" },
];

// 公開時の初期の並び順（空なら上の WORKS の順）
const ORDER = ["anim-wind", "anim-run", "pink-twins", "owari", "hachigatsu-no-yoru", "memeshii"]; // ここに書いた順が先頭、残りは WORKS の順

const PROFILE = {
  name: "矢野 乃梨佳",
  kana: "Norika Yano",
  handle: "",
  affiliation: "立命館大学 映像学部 2回生",
  icon: "aikon.jpg",
  statement: "愛おしい子を、イラストやアニメーションを通してひろめています。",
  email: "im0292vx@ed.ritsumei.ac.jp",
  links: [
    // { label: "X", url: "https://x.com/..." },
  ],
};
