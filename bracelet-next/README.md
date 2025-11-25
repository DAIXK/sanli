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
├─ components/         # Next 外壳组件+管理后台
├─ public/
│  ├─ assets/          # uni-app 打包出来的静态资源
│  ├─ static/          # 3D 模型、纹理等
│  └─ h5/              # index.html 以及辅助资源
├─ scripts/sync-h5.mjs # 资源同步脚本
└─ src/                # 业务逻辑与数据库访问
```

未来如需逐步用 React/Next 重写页面，可在 `src/` 与 `components/` 中实现新的 UI，然后替换掉当前 iframe 壳即可。

## Postgres 与环境变量

1. 安装 Postgres 并创建本地数据库（示例使用 `bracelet`），启用 uuid 扩展：
   ```sql
   CREATE DATABASE bracelet;
   \c bracelet
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```
2. 建表示例（可按需调整字段）：
   ```sql
   CREATE TABLE IF NOT EXISTS admin_users(
     id uuid primary key default uuid_generate_v4(),
     email text unique,
     name text,
     password_hash text,
     created_at timestamptz default now()
   );

   CREATE TABLE IF NOT EXISTS materials(
     id uuid primary key default uuid_generate_v4(),
     name text,
     category text,
     price numeric,
     weight numeric,
     max_quantity int,
     published boolean default true,
     model_url text,
     thumbnail_url text,
     rotation numeric,
     rotation_axis text,
     metadata jsonb,
     created_at timestamptz default now(),
     updated_at timestamptz default now()
   );

   CREATE TABLE IF NOT EXISTS bracelets(
     id uuid primary key default uuid_generate_v4(),
     name text,
     max_beads int,
     base_model text,
     description text,
     created_at timestamptz default now(),
     updated_at timestamptz default now()
   );

   CREATE TABLE IF NOT EXISTS global_settings(
     id int primary key default 1,
     gold_price_per_gram numeric,
     processing_fee numeric,
     currency text,
     updated_at timestamptz default now()
   );
   ```
   如需自动维护 `updated_at`，可为相关表加一个 `BEFORE UPDATE` trigger，把 `NEW.updated_at` 设置成 `now()`。
3. 在项目根目录新增 `.env.local`（或直接使用 `.env.local.example`）：
   ```
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/bracelet
   JWT_SECRET=<任意长度足够的随机字符串>
   ```
   根据本地 Postgres 账号/库名调整连接串。
4. 部署到服务器时，同样配置 `DATABASE_URL` 和 `JWT_SECRET` 环境变量。

## 管理后台 (Postgres + JWT)

- 访问 `/admin/login` 输入 `admin_users` 中的邮箱/密码即可登录，系统会基于 `JWT_SECRET` 颁发 7 天有效的 HTTP-only JWT。
- 登录后进入 `/admin` 仪表盘，可以完成：
  1. **全局设置**：修改实时金价、加工费。
  2. **手串款式**：维护每种手串的最大可添加颗数、背景模型等信息。
  3. **珠子库**：新增/编辑/上下架 tongzhu / yaopian 等素材，设置重量、价格、模型地址、默认旋转等。
- 所有写操作都经由 `app/api/admin/*` API，直接通过 `pg` 连接本地 Postgres；未登录的请求会返回 401。
- 前台可通过 `/api/materials` 获取已上架的珠子与全局配置，供 H5/小程序加载。
