# Bracelet Next H5

基于 Next.js 14 的壳工程，用来承载三粒手串定制 H5。现阶段直接引用 `frontend` 目录编译出来的 uni-app H5 产物，因此功能与原版保持一致，只是交由 Next 统一托管与部署。

## 快速开始

```bash
cd bracelet-next
npm install
npm run dev          # 本机 localhost 访问
# 或者 npm run dev:lan  # 绑定 0.0.0.0，供局域网设备访问
```

本机访问仍是 `http://localhost:3000`。若运行 `npm run dev:lan`，请在浏览器输入 `http://<你的局域网 IP>:3000`，即可在同一 Wi-Fi 下的手机/平板上打开。

## 同步最新 H5 资源

1. 在项目根目录执行：
   ```bash
   cd frontend
   npm install # 首次安装
   npm run build:h5
   ```
2. 构建完成后回到 Next 工程：
   ```bash
   cd ../bracelet-next
   npm run sync:h5
   ```

`sync:h5` 脚本会把 `frontend/dist/build/h5` 下的 `assets`、`static`、`index.html` 等文件拷贝到 Next 的 `public/` 目录，保持内嵌 H5 和 uni-app 构建保持一致。

## 常用脚本

- `npm run dev`：开发模式，仅本机监听。
- `npm run dev:lan`：开发模式并监听 `0.0.0.0`，用于同一局域网多端调试。
- `npm run build`：生成生产环境构建。
- `npm run start`：以生产模式启动。
- `npm run lint`：运行 ESLint。
- `npm run sync:h5`：同步最新 uni-app 构建资源。

## 目录结构

```
bracelet-next/
├─ app/                # Next App Router 入口
├─ components/         # Next 外壳组件，当前以内嵌 iframe 的方式加载 H5
├─ public/
│  ├─ assets/          # uni-app 打包出来的静态资源
│  ├─ static/          # 3D 模型、纹理等
│  └─ h5/              # index.html 以及辅助资源
├─ scripts/sync-h5.mjs # 资源同步脚本
└─ src/                # 预留，后续可逐步改写为纯 Next 组件
```

未来如需逐步用 React/Next 重写页面，可在 `src/` 与 `components/` 中实现新的 UI，然后替换掉当前 iframe 壳即可。
