#!/bin/bash

echo "正在安装后端依赖..."
cd backend
npm install

echo "正在安装前端依赖..."
cd ../frontend
npm install

echo "依赖安装完成!"
echo ""
echo "启动方式:"
echo "  后端: cd backend && npm run dev"
echo "  峰端: cd frontend && npm run dev"
echo ""
echo "访问地址:"
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:3000"