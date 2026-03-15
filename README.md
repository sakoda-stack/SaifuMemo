# SaifuMemo

Vite + React + PWA 構成の家計簿アプリです。デプロイ先は GitHub Pages です。

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

1. GitHub リポジトリの `Settings -> Pages` を開く
2. `Build and deployment -> Source` を `GitHub Actions` にする
3. `main` ブランチへ push する

公開 URL は通常 `https://<GitHubユーザー名>.github.io/SaifuMemo/` です。

## Icons

PWA アイコンは `public/saifu.png` を元に以下を生成して使っています。

- `public/favicon.png`
- `public/apple-touch-icon.png`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`

## Notes

- `vite.config.ts` で GitHub Actions 実行時だけ repository 名から `base` を自動設定しています。
- Vercel 用ファイルは削除済みです。
