# 楼盘销售分析系统

楼盘销售分析系统用于管理房地产项目的楼栋、户型、网签可售快照、销售补充记录和统计分析数据。系统包含 Vue 3 前端、Node.js/Express 后端和 SQLite 本地数据库，可用于日常录入、Excel 批量导入、数据校验和销售趋势分析。

## 功能模块

- 楼盘管理：创建、编辑、删除楼盘，并在页面顶部快速切换当前楼盘。
- 楼栋管理：维护楼栋总房源、已售、可售、去化率等数据。
- 户型管理：维护 1 房、2 房、3 房等户型基础配置。
- 网签录入：按楼栋录入每日可售套数快照，自动推导当日售出。
- 户型销售补充：补充楼栋内不同户型的售出数据，并与楼栋推导售出对比。
- 统计分析：展示项目、楼栋、户型和趋势维度的销售统计。
- 数据校验：检查楼栋、项目、每日网签快照等异常数据。
- Excel 导入：批量导入楼栋、户型结构和可售快照数据。

## 技术栈

- 前端：Vue 3、Vite、Element Plus、ECharts、Pinia、Vue Router、Axios
- 后端：Node.js 22+、Express、SQLite `node:sqlite`
- 部署：Docker、Docker Compose

## 目录结构

```text
.
├── backend/
│   ├── src/                  # 后端源码
│   ├── package.json          # 后端依赖和脚本
│   └── package-lock.json
├── frontend/
│   ├── src/                  # 前端源码
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── package-lock.json
├── Dockerfile
├── docker-compose.yml
├── build.sh                  # 构建 Docker 镜像 tar 包
├── package.sh                # 打包源码和部署文件
└── README.md
```

运行时数据、上传文件、依赖目录和打包产物不会提交到仓库。

## 本地开发

### 环境要求

- Node.js 22+
- npm

### 启动后端

```bash
cd backend
npm install
npm run dev
```

后端默认监听 `http://127.0.0.1:3000`。数据库默认写入项目根目录下的 `data/housing_sales.db`，也可以通过 `DATA_DIR` 环境变量指定数据目录。

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端默认监听 `http://localhost:5173`，并通过 Vite 代理把 `/api` 请求转发到 `http://localhost:3000`。

## Docker 部署

使用 Docker Compose 构建并启动：

```bash
docker-compose up -d --build
```

访问地址：

- 页面：`http://localhost:3000`
- API：`http://localhost:3000/api`

数据文件会持久化到本地 `./data` 目录。

如需构建 AMD64 架构镜像 tar 包：

```bash
./build.sh
```

如需打包源码和部署文件：

```bash
./package.sh
```

打包产物会输出到 `dist/`，不会提交到仓库。

## API 概览

### 楼盘

- `GET /api/project/list`：获取楼盘列表
- `POST /api/project/create`：创建楼盘
- `PUT /api/project/update/:id`：更新楼盘
- `DELETE /api/project/delete/:id`：删除楼盘

### 楼栋

- `GET /api/building/list`：获取楼栋列表
- `GET /api/building/:id`：获取楼栋详情
- `POST /api/building/create`：创建楼栋
- `PUT /api/building/update/:id`：更新楼栋
- `DELETE /api/building/delete/:id`：删除楼栋

### 户型

- `GET /api/unit-type/list`：获取户型列表
- `POST /api/unit-type/create`：创建户型
- `PUT /api/unit-type/update/:id`：更新户型
- `DELETE /api/unit-type/delete/:id`：删除户型

### 网签可售快照

- `GET /api/sign/list`：获取可售快照列表
- `GET /api/sign/daily`：获取当日可售快照与推导售出
- `GET /api/sign/previous`：获取楼栋前一有效快照
- `POST /api/sign/add`：添加可售快照
- `POST /api/sign/batch`：批量保存可售快照
- `DELETE /api/sign/delete/:id`：删除可售快照

### 户型销售补充

- `GET /api/unit-type-sale/differences`：查询楼栋推导售出与户型补充差异
- `GET /api/unit-type-sale/gaps`：查询待补充记录
- `POST /api/unit-type-sale/batch`：批量保存户型销售补充

### 统计与校验

- `GET /api/stat/project`：项目整体统计
- `GET /api/stat/building`：楼栋维度统计
- `GET /api/stat/unit-type`：户型维度统计
- `GET /api/stat/trend`：销售趋势分析
- `GET /api/stat/dashboard`：仪表盘数据
- `GET /api/check/building/:id`：单个楼栋校验
- `GET /api/check/project`：全项目校验
- `GET /api/check/daily-sign`：可售快照异常校验

### Excel 导入

- `POST /api/import/excel`：导入 Excel 文件
- `GET /api/import/template`：下载导入模板

## Excel 导入字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| 楼栋 | 是 | 楼栋名称或编号 |
| 总房源 | 是 | 该楼栋总房源数量 |
| 可售套数 | 否 | 当日网签可售套数 |
| 日期 | 否 | 可售快照日期 |
| 调整套数 | 否 | 新增供应、退房恢复等调整 |
| 1房总数 | 否 | 1 房户型总数量 |
| 1房已售 | 否 | 1 房户型已售数量 |
| 2房总数 | 否 | 2 房户型总数量 |
| 2房已售 | 否 | 2 房户型已售数量 |
| 3房总数 | 否 | 3 房户型总数量 |
| 3房已售 | 否 | 3 房户型已售数量 |

## 数据说明

数据库表会在后端启动时自动初始化，主要包含：

- `project`：楼盘表
- `building`：楼栋表
- `unit_type`：户型表
- `building_unit_type`：楼栋户型结构表
- `daily_sign_record`：每日网签可售快照表
- `unit_type_sale_record`：户型销售补充表
