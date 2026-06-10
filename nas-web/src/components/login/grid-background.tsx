/**
 * GridBackground — 登录页 SVG 点阵网格背景
 *
 * 高密度点阵 + 几何连线 + 信号流光动画 + 呼吸节点
 * 使用 SVG pattern 渲染底层点阵（高性能），手动绘制连线和特效。
 */

const SPACING = 20;
const VIEW_W = 1200;
const VIEW_H = 800;

/** 连线组：网格坐标 [x, y]（像素），相邻点依次连线 */
const connections: number[][][] = [
  // 左上 — 大矩形
  [[80,60],[80,160],[200,160],[200,60],[80,60]],
  // 左上 — 内嵌小方块
  [[100,80],[100,120],[140,120],[140,80],[100,80]],
  // 上方中间 — 六边形
  [[460,40],[500,60],[500,100],[460,120],[420,100],[420,60],[460,40]],
  // 右上 — 大三角
  [[900,40],[1000,140],[800,140],[900,40]],
  // 右上角 — 网格块
  [[1020,60],[1020,160],[1120,160],[1120,60],[1020,60]],
  [[1040,80],[1040,140],[1100,140],[1100,80],[1040,80]],
  // 左中 — L 型
  [[60,340],[60,460],[160,460],[160,400],[100,400],[100,340],[60,340]],
  // 中央左 — 菱形
  [[300,360],[360,400],[300,440],[240,400],[300,360]],
  // 中央 — 大十字
  [[560,360],[600,360],[600,340],[640,340],[640,360],[680,360],[680,400],[640,400],[640,420],[600,420],[600,400],[560,400],[560,360]],
  // 中央右 — 连续折线
  [[740,320],[780,320],[780,360],[820,360],[820,400],[860,400],[860,440]],
  // 右中 — 方阵
  [[960,340],[960,440],[1060,440],[1060,340],[960,340]],
  [[980,360],[980,420],[1040,420],[1040,360],[980,360]],
  // 左下 — 阶梯
  [[80,560],[120,560],[120,600],[160,600],[160,640],[200,640],[200,680]],
  // 中下 — 大矩形+对角线
  [[440,580],[440,720],[600,720],[600,580],[440,580]],
  [[440,580],[600,720]],
  [[600,580],[440,720]],
  // 下方偏右 — 平行四边形
  [[740,600],[800,580],[900,580],[840,600],[740,600]],
  // 右下 — 锯齿
  [[960,560],[1000,600],[1040,560],[1080,600],[1120,560]],
  // 右下角 — 嵌套方块
  [[1000,640],[1000,740],[1140,740],[1140,640],[1000,640]],
  [[1020,660],[1020,720],[1120,720],[1120,660],[1020,660]],
  [[1040,680],[1040,700],[1100,700],[1100,680],[1040,680]],
  // 左下角 — 三角群
  [[60,680],[120,720],[60,760],[60,680]],
  [[120,680],[180,720],[120,760],[120,680]],
  // 上方连接线
  [[240,80],[320,80],[320,120],[400,120]],
  [[640,60],[720,60],[720,100],[780,100],[780,140]],
  // 底部长连接
  [[260,740],[340,740],[340,700],[420,700]],
  [[640,740],[740,740],[740,700],[800,700]],
];

/** 信号流光路径（CSS stroke-dashoffset 动画） */
const signalPaths: { d: string; duration: string; delay: string }[] = [
  { d: "M80,60 L200,60 L200,160 L80,160", duration: "4s", delay: "0s" },
  { d: "M460,40 L500,60 L500,100 L460,120 L420,100 L420,60 L460,40", duration: "5s", delay: "1s" },
  { d: "M900,40 L1000,140 L800,140 L900,40", duration: "3.5s", delay: "0.5s" },
  { d: "M60,340 L60,460 L160,460 L160,400 L100,400 L100,340 L60,340", duration: "5s", delay: "2s" },
  { d: "M740,320 L780,320 L780,360 L820,360 L820,400 L860,400 L860,440", duration: "3s", delay: "1.5s" },
  { d: "M80,560 L120,560 L120,600 L160,600 L160,640 L200,640 L200,680", duration: "3.5s", delay: "0.8s" },
  { d: "M960,560 L1000,600 L1040,560 L1080,600 L1120,560", duration: "2.5s", delay: "2.5s" },
  { d: "M240,80 L320,80 L320,120 L400,120", duration: "2s", delay: "3s" },
];

/** 活跃呼吸节点（像素坐标） */
const activeNodes: { x: number; y: number; delay: number }[] = [
  { x: 80, y: 60, delay: 0 },
  { x: 200, y: 160, delay: 0.4 },
  { x: 460, y: 40, delay: 0.8 },
  { x: 900, y: 40, delay: 1.2 },
  { x: 1120, y: 60, delay: 1.6 },
  { x: 60, y: 460, delay: 2.0 },
  { x: 300, y: 360, delay: 0.3 },
  { x: 680, y: 360, delay: 0.7 },
  { x: 860, y: 440, delay: 1.1 },
  { x: 1060, y: 440, delay: 1.5 },
  { x: 120, y: 560, delay: 1.9 },
  { x: 600, y: 720, delay: 2.3 },
  { x: 1140, y: 740, delay: 0.5 },
  { x: 60, y: 760, delay: 1.3 },
  { x: 780, y: 100, delay: 2.1 },
  { x: 440, y: 580, delay: 0.6 },
  { x: 1040, y: 680, delay: 1.8 },
  { x: 340, y: 740, delay: 2.4 },
];

export function GridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="h-full w-full opacity-60 dark:opacity-40"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* 点阵 pattern（高性能渲染） */}
          <pattern id="dot-grid" x="0" y="0" width={SPACING} height={SPACING} patternUnits="userSpaceOnUse">
            <circle cx={SPACING / 2} cy={SPACING / 2} r="1" fill="var(--muted-foreground)" opacity="0.35" />
          </pattern>

          {/* 中心径向渐变遮罩：让卡片区域更干净 */}
          <radialGradient id="center-fade" cx="50%" cy="50%" r="40%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="100%" stopColor="white" stopOpacity="1" />
          </radialGradient>
          <mask id="vignette-mask">
            <rect width="100%" height="100%" fill="white" />
            <ellipse cx="50%" cy="50%" rx="25%" ry="30%" fill="black" opacity="0.7" />
          </mask>

          {/* 信号流光渐变 */}
          <linearGradient id="signal-grad">
            <stop offset="0%" stopColor="var(--ring)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--ring)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--ring)" stopOpacity="0" />
          </linearGradient>

          <style>{`
            @keyframes pulse-node {
              0%, 100% { opacity: 0.2; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.8); }
            }
            @keyframes signal-flow {
              0% { stroke-dashoffset: 200; }
              100% { stroke-dashoffset: -200; }
            }
            .conn-line {
              stroke: var(--muted-foreground);
              stroke-width: 0.6;
              opacity: 0.2;
              fill: none;
            }
            .active-node {
              fill: var(--ring);
              transform-origin: center;
              animation: pulse-node 3s ease-in-out infinite;
            }
            .signal-path {
              fill: none;
              stroke: var(--ring);
              stroke-width: 1.5;
              stroke-dasharray: 40 160;
              stroke-linecap: round;
              opacity: 0.6;
              animation: signal-flow linear infinite;
            }
          `}</style>
        </defs>

        {/* 底层：密集点阵（通过 pattern 渲染） */}
        <rect
          width="100%"
          height="100%"
          fill="url(#dot-grid)"
          mask="url(#vignette-mask)"
        />

        {/* 连线层 */}
        <g mask="url(#vignette-mask)">
          {connections.map((pts, i) => (
            <polyline
              key={`c-${i}`}
              className="conn-line"
              points={pts.map(p => p.join(",")).join(" ")}
            />
          ))}
        </g>

        {/* 信号流光层 */}
        {signalPaths.map((sp, i) => (
          <path
            key={`s-${i}`}
            className="signal-path"
            d={sp.d}
            style={{ animationDuration: sp.duration, animationDelay: sp.delay }}
          />
        ))}

        {/* 活跃节点层 */}
        {activeNodes.map((node, i) => (
          <circle
            key={`n-${i}`}
            className="active-node"
            cx={node.x}
            cy={node.y}
            r="2.5"
            style={{ animationDelay: `${node.delay}s` }}
          />
        ))}
      </svg>
    </div>
  );
}
