#!/bin/bash

# =================================================================
# Hajihan-PDF 一键启动脚本
# 适配环境: Sealos / Docker / Linux VM
# =================================================================

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}[1/3] 正在安装后端依赖...${NC}"
pip install -r /home/devbox/project/tool/watermark/v2/backend/requirements.txt --quiet

echo -e "${BLUE}[2/3] 正在准备前端环境...${NC}"
# 确保 node_bin 在 PATH 中
export PATH=/home/devbox/project/node_bin/bin:$PATH

# 如果没有 node_modules 则安装 (可选，通常镜像已包含)
cd /home/devbox/project/tool/watermark/v2/frontend
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}检测到 node_modules 不存在，正在安装前端依赖...${NC}"
    npm install --quiet
fi

# 启动后端服务 (FastAPI)
echo -e "${GREEN}[OK] 正在后台启动后端 API (Port 8000)...${NC}"
cd /home/devbox/project/tool/watermark/v2/backend
nohup python main.py > backend.log 2>&1 &

# 启动前端服务 (Next.js)
echo -e "${GREEN}[OK] 正在启动前端界面 (Port 3000)...${NC}"
cd /home/devbox/project/tool/watermark/v2/frontend
# 使用 exec 确保 shell 信号能传递给 npm 进程
exec npm run dev
