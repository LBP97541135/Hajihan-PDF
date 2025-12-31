# Hajihan-PDF

一个功能强大的 PDF 处理工具箱，支持水印添加、元数据查询、文档体检及电子签名。

## 功能特性

- **文档体检中心 (PDF Info Query)**: 深度解析 PDF 元数据，包括：
  - 基础信息：页数、文件大小、版本、加密状态。
  - 资源统计：图片数量、字体数量、链接数量、注释数量。
  - 权限检测：打印、修改、复制、批注、表单填写权限。
  - 内容分析：自动识别原生 PDF 与扫描件。
  - 签名检测：精准识别文档是否包含数字签名。
- **智能加水印 (Add Watermark)**: 支持自定义文本水印，实时预览，支持调整颜色、透明度、旋转角度及缩放比例。
- **电子签名 (PDF Sign)**: 支持在 PDF 文档中添加可视化签名。
- **更多功能**: 水印去除、文档加解密等功能持续开发中。

## 技术栈

- **前端**: Next.js 15, Tailwind CSS, Lucide Icons, Framer Motion
- **后端**: FastAPI, PyMuPDF (fitz), Pillow

## 快速开始

### 后端启动

1. 进入 `backend` 目录
2. 安装依赖:
   ```bash
   pip install fastapi uvicorn pymupdf pillow python-multipart
   ```
3. 启动服务:
   ```bash
   python main.py
   ```
   后端默认运行在 `http://localhost:8000`

### 前端启动

1. 进入 `frontend` 目录
2. 安装依赖:
   ```bash
   npm install
   ```
3. 启动开发服务器:
   ```bash
   npm run dev
   ```
   前端默认运行在 `http://localhost:3000`

---
Developed by Hajihan.
