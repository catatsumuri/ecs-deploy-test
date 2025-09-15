// AWS CDK ライブラリのインポート
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

/**
 * ECS デプロイテスト用のスタッククラス
 * Nginx コンテナをECS Fargateで実行する基本的な構成を定義
 */
export class EcsDeployTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // コンテキストからNginxイメージタグを取得（デフォルトは'1.27'）
    const imageTag = this.node.tryGetContext('imageTag') || '1.27';
    
    // コンテナ起動時に実行されるデフォルトスクリプト
    const startupScript = `
      echo "Starting Nginx container..."
      echo "Nginx version: $(nginx -v 2>&1)"
      echo "Container started at: $(date)"
      
      # Create custom index.html with version info
      cat > /usr/share/nginx/html/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Nginx Deploy Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background-color: #f4f4f4; }
        .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .version { color: #007acc; font-weight: bold; }
        .timestamp { color: #666; font-size: 0.9em; }
        .tag { color: #28a745; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Nginx Deploy Test</h1>
        <p>Container successfully deployed!</p>
        <p class="tag">Image Tag: ${imageTag}</p>
        <p class="version">Nginx Version: NGINX_VERSION_PLACEHOLDER</p>
        <p class="timestamp">Deployed at: TIMESTAMP_PLACEHOLDER</p>
        <hr>
        <p>This container is running on ECS Fargate with direct access.</p>
    </div>
</body>
</html>
EOF

      # Replace placeholders with actual values
      NGINX_VER=$(nginx -v 2>&1 | sed 's/.*nginx\\/\\([^[:space:]]*\\).*/\\1/')
      TIMESTAMP=$(date)
      sed -i "s/NGINX_VERSION_PLACEHOLDER/$NGINX_VER/g" /usr/share/nginx/html/index.html
      sed -i "s/TIMESTAMP_PLACEHOLDER/$TIMESTAMP/g" /usr/share/nginx/html/index.html
      
      echo "Custom HTML page created successfully"
      
      # Start nginx
      nginx -g 'daemon off;'
    `;

    // VPCの作成（パブリックサブネットのみ、プライベートサブネットは不要）
    const vpc = new ec2.Vpc(this, 'EcsVpc', {
      maxAzs: 2,                    // 最大2つのアベイラビリティーゾーンを使用
      natGateways: 0,               // NATゲートウェイは作成しない（コスト削減）
      subnetConfiguration: [
        {
          cidrMask: 24,             // /24 サブネットマスク
          name: 'public',           // サブネット名
          subnetType: ec2.SubnetType.PUBLIC,  // パブリックサブネット
        },
      ],
    });

    // ECSクラスターの作成
    const cluster = new ecs.Cluster(this, 'DeployTestCluster', {
      vpc,                                    // 上記で作成したVPCを使用
      clusterName: 'DeployTestCluster',       // クラスター名
    });

    // Fargateタスク定義の作成
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      memoryLimitMiB: 512,              // メモリ制限: 512MB
      cpu: 256,                         // CPU制限: 256 CPU単位（0.25 vCPU）
    });

    // タスク定義にNginxコンテナを追加
    const container = taskDefinition.addContainer('nginx', {
      image: ecs.ContainerImage.fromRegistry(`public.ecr.aws/nginx/nginx:${imageTag}`),  // パブリックECRからNginxイメージを取得
      memoryLimitMiB: 512,              // コンテナのメモリ制限
      logging: ecs.LogDrivers.awsLogs({ // CloudWatch Logsでログ出力
        streamPrefix: 'nginx',          // ログストリームのプレフィックス
      }),
      command: ['/bin/bash', '-c', startupScript],  // 起動時に実行するコマンド
    });

    // コンテナのポートマッピングを設定（HTTP用）
    container.addPortMappings({
      containerPort: 80,                // コンテナ内のポート番号
      protocol: ecs.Protocol.TCP,       // プロトコル（HTTP用にTCP）
    });

    // ECSサービス用のセキュリティグループを作成（直接アクセス用）
    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
      vpc,                                        // 作成したVPCを指定
      description: 'Security group for ECS service',  // セキュリティグループの説明
      allowAllOutbound: true,                     // 全てのアウトバウンドトラフィックを許可
    });

    // HTTPトラフィック（ポート80）を全てのIPアドレスから許可
    ecsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),               // 全てのIPv4アドレスから
      ec2.Port.tcp(80),                 // TCPポート80（HTTP）
      'Allow HTTP traffic from anywhere'  // ルールの説明
    );

    // パブリックIPを持つFargateサービスの作成
    const service = new ecs.FargateService(this, 'DeployTestService', {
      cluster,                          // 上記で作成したクラスターを指定
      taskDefinition,                   // 上記で作成したタスク定義を指定
      desiredCount: 1,                  // 実行するタスク数（1つ）
      assignPublicIp: true,             // パブリックIPアドレスを割り当て
      securityGroups: [ecsSecurityGroup],  // 上記で作成したセキュリティグループを適用
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,  // パブリックサブネットに配置
      },
      serviceName: 'DeployTestService', // サービス名
    });

    // デプロイ後に出力される情報を定義
    new cdk.CfnOutput(this, 'ServiceName', {
      value: service.serviceName,
      description: 'ECS Service Name',        // ECSサービス名
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      description: 'ECS Cluster Name',        // ECSクラスター名
    });

    new cdk.CfnOutput(this, 'ImageTag', {
      value: imageTag,
      description: 'Nginx Docker image tag used',  // 使用されたNginxイメージタグ
    });
  }
}
