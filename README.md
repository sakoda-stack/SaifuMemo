# さいふメモ PWA版
## Windows → GitHub → Vercel → iPhoneホーム画面 完全ガイド

---

## 📁 プロジェクト構成（全ファイル）

```
SaifuMemoPWA/
├── index.html               ← PWAのHTML
├── package.json             ← 依存パッケージ
├── vite.config.ts           ← ビルド設定・Service Worker自動生成
├── tailwind.config.js       ← スタイル設定
├── postcss.config.js
├── tsconfig.json
├── public/                  ← ← アイコン等の静的ファイル（要作成）
│   ├── favicon.svg
│   ├── apple-touch-icon.png ← iPhoneホーム画面アイコン(180x180)
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
└── src/
    ├── main.tsx             ← Reactエントリー
    ├── App.tsx              ← タブバー
    ├── index.css
    ├── types/index.ts       ← 型定義
    ├── db/database.ts       ← IndexedDB設定・初期データ
    ├── utils/index.ts       ← フォーマット・CSV生成
    └── components/
        ├── home/HomeScreen.tsx
        ├── list/ListScreen.tsx
        ├── add/AddExpenseModal.tsx
        ├── add/AddMedicalModal.tsx
        ├── medical/MedicalScreen.tsx
        └── settings/SettingsScreen.tsx
```

---

## 🖥️ ステップ1: Windowsでローカル起動

```bash
# 1. Node.jsをインストール（https://nodejs.org → LTS版）

# 2. ZIPを解凍してフォルダに入る
cd SaifuMemoPWA

# 3. パッケージインストール
npm install

# 4. 起動
npm run dev
# → ブラウザで http://localhost:5173 が開く
```

---

## 🎨 ステップ2: アイコン画像を用意する

1. https://favicon.io/favicon-generator/ を開く
2. 以下で設定してDownload:
   - Text: さ
   - Background Color: #3B7DD8
   - Font Color: #FFFFFF
   - Font Size: 110
3. ダウンロードしたZIPを解凍
4. 以下の名前で `public/` フォルダに配置:
   - `android-chrome-192x192.png` → `public/icons/icon-192.png`
   - `android-chrome-512x512.png` → `public/icons/icon-512.png`
   - `apple-touch-icon.png`       → `public/apple-touch-icon.png`
   - `favicon.ico`                → `public/favicon.ico`
   - favicons/から `favicon-16x16.png` を `public/favicon.svg` として（またはsvg作成）

---

## 🌐 ステップ3: GitHubにアップロード

### GitHubリポジトリ作成（ブラウザのみ）

1. https://github.com にログイン
2. 右上「＋」→「New repository」
3. 設定:
   - Repository name: `saifumemo`
   - **Private を選択**（重要）
   - README・gitignoreは追加しない
4. 「Create repository」

### ファイルアップロード（コマンド不要）

1. リポジトリページで「uploading an existing file」をクリック
2. `SaifuMemoPWA` フォルダの中身を全選択してドラッグ＆ドロップ
   ⚠️ `node_modules` フォルダは除外する
3. 「Commit changes」をクリック

---

## 🚀 ステップ4: Vercelにデプロイ（無料）

1. https://vercel.com を開いて「Start Deploying」
2. 「Continue with GitHub」でGitHubログイン
3. 「Add New... → Project」
4. `saifumemo` を選んで「Import」
5. 設定確認（自動認識されるはず）:
   - Framework: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. 「Deploy」をクリック
7. 1〜2分で `https://saifumemo-abc123.vercel.app` のURLができる

---

## 📱 ステップ5: iPhoneのホーム画面に追加（妻への案内）

LINEで以下のメッセージを送る:

```
URLを送るね。
Safariで開いて、下の「共有」ボタン（□↑）→「ホーム画面に追加」してね。
アイコンが追加されたらそこから起動できるよ！

https://saifumemo-xxxx.vercel.app
```

手順:
1. **Safariで**URLを開く（ChromeやLINEブラウザは不可）
2. 画面下の「共有」ボタン（□↑）をタップ
3. 「ホーム画面に追加」をタップ
4. 「追加」をタップ
5. ホーム画面のアイコンから起動するとアプリ風に動く

---

## ⚡ スピード・オフライン対応

| 操作 | 速度 |
|------|------|
| 画面切替 | 瞬時（通信ゼロ） |
| 入力・保存 | 瞬時（端末内DB） |
| 集計・グラフ | 瞬時 |
| CSV出力 | 1秒以内 |
| オフライン | ✅ 完全動作 |
| 初回読み込み | 2〜3秒（2回目以降はキャッシュで瞬時） |

データはiPhone内のIndexedDBに保存。サーバーに送信されません。

---

## 🔄 コードを更新するとき

1. GitHubで対象ファイルを開く
2. 鉛筆アイコン（Edit this file）をクリック
3. 修正して「Commit changes」
4. Vercelが自動でビルド（1〜2分）
5. 奥さんのiPhoneで次回起動時に自動更新

---

## ❓ FAQ

**Q: URLを知らない人が見られる？**
A: VercelのURLはランダムな文字列なので、知らない人が偶然たどり着く確率は極めて低い。
   家計簿用途なら十分。さらに安全にしたいならVercelのPassword Protectionを使う（有料）。

**Q: iPhone変えたらデータは？**
A: 端末内保存のため引き継がれない。定期的にCSV出力でバックアップを。

**Q: Androidでも使える？**
A: 使える。ChromeでURLを開いて「ホーム画面に追加」でインストール。

**Q: データが消える心配は？**
A: Safariの「サイトデータを削除」をしない限り消えない。
   念のため月1回CSV出力でバックアップ推奨。
