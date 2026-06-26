import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import projectRoutes from './routes/project.js';
import buildingRoutes from './routes/building.js';
import unitTypeRoutes from './routes/unitType.js';
import unitTypeSaleRoutes from './routes/unitTypeSale.js';
import signRoutes from './routes/sign.js';
import statRoutes from './routes/stat.js';
import checkRoutes from './routes/check.js';
import importRoutes from './routes/import.js';
import { initDatabase } from './db/init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/project', projectRoutes);
app.use('/api/building', buildingRoutes);
app.use('/api/unit-type', unitTypeRoutes);
app.use('/api/unit-type-sale', unitTypeSaleRoutes);
app.use('/api/sign', signRoutes);
app.use('/api/stat', statRoutes);
app.use('/api/check', checkRoutes);
app.use('/api/import', importRoutes);

// 静态文件服务（生产环境）
const staticPath = process.env.STATIC_PATH || path.join(__dirname, '..', 'frontend', 'dist');
if (process.env.NODE_ENV === 'production') {
  // 生产环境：静态文件优先，SPA fallback
  app.use(express.static(staticPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(staticPath, 'index.html'));
  });
} else {
  // 开发环境：根路径返回 API 信息
  app.get('/', (req, res) => {
    res.json({ message: '楼盘销售分析系统 API' });
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    code: status,
    message: err.message || '服务器内部错误',
    errors: err.errors || []
  });
});

async function start() {
  await initDatabase();
  app.listen(PORT, HOST, () => {
    console.log(`服务器运行在 http://${HOST}:${PORT}`);
    if (process.env.NODE_ENV === 'production') {
      console.log(`静态文件服务路径: ${staticPath}`);
    }
  });
}

start();
