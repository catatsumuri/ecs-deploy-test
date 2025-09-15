# ECS デプロイテストプロジェクト

このプロジェクトは、AWS CDK v2 と TypeScript を使用して ECS Fargate 上で Nginx コンテナをデプロイするためのサンプルプロジェクトです。

## プロジェクト概要

- **目的**: ECS Fargate を使用したコンテナデプロイの学習・テスト
- **使用技術**: AWS CDK v2, TypeScript, ECS Fargate, Nginx
- **デプロイ対象**: パブリック IP を持つ Nginx コンテナ

## 構築されるAWSリソース

このCDKスタックでは以下のAWSリソースが作成されます：

### ネットワーク構成
- **VPC**: 2つのアベイラビリティーゾーンにまたがるVPC
- **パブリックサブネット**: インターネットゲートウェイ経由でアクセス可能
- **セキュリティグループ**: HTTP（ポート80）トラフィックを全てのIPから許可

### ECS構成
- **ECSクラスター**: コンテナを実行するためのクラスター
- **Fargateタスク定義**: Nginxコンテナの実行設定（CPU: 256, Memory: 512MB）
- **Fargateサービス**: パブリックIPを持つコンテナサービス（1タスク実行）

### コンテナ設定
- **ベースイメージ**: `public.ecr.aws/nginx/nginx:1.27`（デフォルト）
- **カスタムHTML**: デプロイ情報を表示するカスタマイズされたindex.html
- **ログ出力**: CloudWatch Logsにログを送信

## 開発コマンド

### 基本操作
```bash
npm install              # 依存関係のインストール
npm run watch           # ファイル変更の監視とコンパイル（オプション）
npm test                # Jest単体テストの実行
```

### CDK操作
```bash
npx cdk bootstrap       # 初回のみ: CDKブートストラップ
npx cdk synth          # CloudFormationテンプレートの生成・表示
npx cdk diff           # デプロイ済みスタックとの差分表示
npx cdk deploy         # AWSアカウントへのデプロイ
npx cdk destroy        # スタックの削除
```

**注意**: `npm run build` は通常不要です。CDKは `ts-node` を使用して直接TypeScriptファイルを実行します。

## デプロイ手順

1. **AWS認証情報の設定**
   ```bash
   aws configure
   # または環境変数・IAMロールを使用
   ```

2. **初回セットアップ**
   ```bash
   npm install
   npx cdk bootstrap
   ```

3. **デプロイ実行**
   ```bash
   npx cdk deploy
   ```

4. **アクセス確認**
   - デプロイ後に出力されるサービス情報を確認
   - ECSコンソールでタスクのパブリックIPを取得
   - ブラウザでアクセス: `http://<パブリックIP>`

## カスタマイズ

### イメージタグの変更
```bash
npx cdk deploy -c imageTag=1.21
```

### リソース設定の変更
`lib/ecs-deploy-test-stack.ts` でCPU、メモリ、タスク数などを調整可能です。

## ファイル構成

```
.
├── bin/
│   └── ecs-deploy-test.ts     # CDKアプリケーションエントリーポイント
├── lib/
│   └── ecs-deploy-test-stack.ts # メインのCDKスタック定義
├── test/
│   └── ecs-deploy-test.test.ts  # Jest単体テスト
├── cdk.json                   # CDK設定ファイル
├── package.json              # npm設定・依存関係
└── CLAUDE.md                 # Claude Code用プロジェクト指示
```

## トラブルシューティング

### よくある問題
1. **認証エラー**: AWS認証情報が正しく設定されているか確認
2. **リソース制限**: AWS アカウントのサービス制限を確認
3. **デプロイ失敗**: `npx cdk diff` で変更内容を事前確認

### ログ確認
- CloudWatch Logs コンソールでコンテナのログを確認可能
- ログストリーム名: `/aws/ecs/nginx-*`
