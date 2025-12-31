"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Droplets, Settings, Eye, Download, Loader2, Grid, Maximize, Square, RotateCw, Scaling, Info, FileText, Shield, Layers, Type, Image as ImageIcon, Link as LinkIcon, Lock, CheckCircle2, XCircle, ChevronDown, ChevronUp, Calendar, User, Tag } from 'lucide-react';
import Link from 'next/link';
import PDFUploader from '@/components/PDFUploader';
import axios from 'axios';

const API_BASE = '';

type WatermarkLayout = 'single' | 'nine-grid' | 'full-screen';
type WatermarkDensity = 'loose' | 'moderate' | 'dense';

export default function AddWatermarkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [watermarkText, setWatermarkText] = useState('Hajihan PDF');
  const [opacity, setOpacity] = useState(0.3);
  const [fontSize, setFontSize] = useState(50);
  const [angle, setAngle] = useState(45);
  const [color, setColor] = useState('#000000');
  const [layout, setLayout] = useState<WatermarkLayout>('single');
  const [density, setDensity] = useState<WatermarkDensity>('moderate');
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
  const [fontFamily, setFontFamily] = useState('song');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number, height: number }>({ width: 200, height: 200 });
  const [imageScale, setImageScale] = useState(0.5);
  const [pageInfo, setPageInfo] = useState<{ width: number, height: number } | null>(null);
  const [customPosition, setCustomPosition] = useState<{ x: number, y: number } | null>(null);
  const [previewSize, setPreviewSize] = useState<{ width: number, height: number } | null>(null);
  const [pdfMetadata, setPdfMetadata] = useState<any>(null);
  const [showFullMetadata, setShowFullMetadata] = useState(false);
  // 追踪当前预览图的状态：'clean' (纯净底图) 或 'watermarked' (已由后端合成水印)
  const [previewMode, setPreviewMode] = useState<'clean' | 'watermarked' | 'none'>('none');
  const previewRef = React.useRef<HTMLImageElement>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setPreviewUrl(null); // 清除旧预览
    setPreviewMode('none'); // 重置模式
    setCustomPosition(null); // 重置位置
    // 获取文件信息以获取宽高
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await axios.post(`${API_BASE}/api/pdf-info`, formData);
      setPdfMetadata(response.data);
      if (response.data.pages && response.data.pages.length > 0) {
        const info = {
          width: response.data.pages[0].width,
          height: response.data.pages[0].height
        };
        setPageInfo(info);
        // 初始化单点位置为中心
        setCustomPosition({ x: info.width / 2, y: info.height / 2 });
      }
    } catch (error) {
      console.error('Failed to get PDF info:', error);
    }
  };

  const getCssFontFamily = (fontVal: string) => {
    switch(fontVal) {
      case 'song': return '"SimSun", "Songti SC", serif';
      case 'kai': return '"KaiTi", "Kaiti SC", serif';
      case 'xingkai': return '"STXingkai", "Xingkai SC", cursive';
      case 'yahei': return '"Microsoft YaHei", "Heiti SC", sans-serif';
      case 'times-roman': return '"Times New Roman", serif';
      default: return 'sans-serif';
    }
  };

  const getWatermarkElements = (width: number, height: number) => {
    const elements = [];
    
    const baseElement = watermarkType === 'text' ? {
      type: "text",
      text: watermarkText,
      fontsize: fontSize,
      opacity: opacity,
      color: color,
      angle: angle,
      fontname: fontFamily
    } : {
      type: "image",
      scale: imageScale,
      opacity: opacity,
      angle: angle,
      // 注意：这里不直接传 base64，后端会通过单独的文件上传处理以提高性能
      // 但在预览时，我们需要标记这是一个图片占位符
      isPlaceholder: true 
    };

    // 估算单个水印占据的投影尺寸
    let projectedWidth = 100;
    let projectedHeight = 100;

    if (watermarkType === 'text') {
      const estimatedTextWidth = fontSize * (watermarkText.length * 0.5);
      const absAngleRad = Math.abs(angle * Math.PI / 180);
      projectedWidth = estimatedTextWidth * Math.cos(absAngleRad) + fontSize * Math.sin(absAngleRad);
      projectedHeight = estimatedTextWidth * Math.sin(absAngleRad) + fontSize * Math.cos(absAngleRad);
    } else {
      // 图片估算尺寸 (基于原始图片尺寸，按比例缩放)
      const baseWidth = imageSize.width * imageScale;
      const baseHeight = imageSize.height * imageScale;
      const absAngleRad = Math.abs(angle * Math.PI / 180);
      projectedWidth = baseWidth * Math.abs(Math.cos(absAngleRad)) + baseHeight * Math.abs(Math.sin(absAngleRad));
      projectedHeight = baseWidth * Math.abs(Math.sin(absAngleRad)) + baseHeight * Math.abs(Math.cos(absAngleRad));
    }

    if (layout === 'single') {
      elements.push({
        ...baseElement,
        x: customPosition?.x ?? width / 2,
        y: customPosition?.y ?? height / 2
      });
    } else if (layout === 'nine-grid') {
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          elements.push({
            ...baseElement,
            x: (width / 3) * (i + 0.5),
            y: (height / 3) * (j + 0.5)
          });
        }
      }
    } else if (layout === 'full-screen') {
      const densityMultipliers = {
        'loose': { x: 2.5, y: 3.0 },
        'moderate': { x: 1.5, y: 2.0 },
        'dense': { x: 1.0, y: 1.2 }
      };
      const multiplier = densityMultipliers[density];

      const stepX = Math.max(projectedWidth * multiplier.x, 100); 
      const stepY = Math.max(projectedHeight * multiplier.y, 100);

      const cols = Math.min(Math.max(Math.floor(width / stepX), 1), 15);
      const rows = Math.min(Math.max(Math.floor(height / stepY), 1), 20);

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          elements.push({
            ...baseElement,
            x: (width / cols) * (i + 0.5),
            y: (height / rows) * (j + 0.5)
          });
        }
      }
    }
    return elements;
  };

  const fetchPreview = async () => {
    if (!file || !pageInfo) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (imageFile) {
        formData.append('watermark_image', imageFile);
      }
      
      // 核心修复：如果是单点模式，预览时不传给后端，避免产生“双重水印”
      const page_modifiers = {
        "0": layout === 'single' ? [] : getWatermarkElements(pageInfo.width, pageInfo.height)
      };
      
      formData.append('page_modifiers_json', JSON.stringify(page_modifiers));

      const response = await axios.post(`${API_BASE}/api/preview`, formData, {
        params: { page_index: 0 },
        responseType: 'blob'
      });
      
      const url = URL.createObjectURL(response.data);
      setPreviewUrl(url);
      // 更新当前预览模式状态
      setPreviewMode(layout === 'single' ? 'clean' : 'watermarked');
    } catch (error) {
      console.error('Failed to fetch preview:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (file && pageInfo) {
      // 智能判断是否需要重新获取预览
      // 如果是单点模式 (前端渲染)，且当前已经是纯净底图，则无需请求后端
      if (layout === 'single' && previewMode === 'clean' && previewUrl) {
        return;
      }

      const timer = setTimeout(fetchPreview, 300); // 缩短防抖时间以提升响应速度
      return () => clearTimeout(timer);
    }
    // 依赖项优化：移除 customPosition 以避免拖拽时触发重绘
    // 单点模式下，其他参数变化也不需要触发后端重绘（因为是前端渲染）
    // 注意：如果修改了此数组，可能需要刷新页面以重置 Hook 状态
  }, [file, pageInfo, watermarkText, opacity, fontSize, angle, color, layout, density, watermarkType, fontFamily, imageFile, imageScale]);

  const handleDownload = async () => {
    if (!file || !pageInfo) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (imageFile) {
        formData.append('watermark_image', imageFile);
      }
      
      const page_modifiers: any = {};
      const elements = getWatermarkElements(pageInfo.width, pageInfo.height);
      
      // 这里假设用户想要加到所有页，实际上后端 reconstruct 应该支持传入总页数
      // 或者我们可以从 pdf-info 获取总页数
      const infoResponse = await axios.post(`${API_BASE}/api/pdf-info`, formData);
      const totalPages = infoResponse.data.page_count;

      for(let i=0; i < totalPages; i++) {
        page_modifiers[i.toString()] = elements;
      }
      
      formData.append('page_modifiers_json', JSON.stringify(page_modifiers));

      const response = await axios.post(`${API_BASE}/api/reconstruct`, formData, {
        responseType: 'blob'
      });
      
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `watermarked_${file.name}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // 移除重复的 useEffect 116-122

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div className="flex items-center gap-2">
              <Droplets className="w-6 h-6 text-blue-600" />
              <h1 className="font-bold text-lg text-slate-900">增加水印</h1>
            </div>
          </div>
          {file && (
            <button 
              onClick={handleDownload}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              导出 PDF
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!file ? (
          <div className="max-w-2xl mx-auto mt-20">
            <PDFUploader onFileSelect={handleFileSelect} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Settings Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              <section className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-6 text-slate-900">
                  <Settings className="w-5 h-5 text-blue-600" />
                  <h2 className="font-bold">水印设置</h2>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-3 block">水印类型</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button 
                        onClick={() => setWatermarkType('text')}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${watermarkType === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        文字水印
                      </button>
                      <button 
                        onClick={() => setWatermarkType('image')}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${watermarkType === 'image' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        图片水印
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-3 block">排列布局</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button 
                        onClick={() => setLayout('single')}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${layout === 'single' ? 'bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                      >
                        <Square className="w-5 h-5" />
                        <span className="text-xs font-medium">单点</span>
                      </button>
                      <button 
                        onClick={() => setLayout('nine-grid')}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${layout === 'nine-grid' ? 'bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                      >
                        <Grid className="w-5 h-5" />
                        <span className="text-xs font-medium">九宫格</span>
                      </button>
                      <button 
                        onClick={() => setLayout('full-screen')}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${layout === 'full-screen' ? 'bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                      >
                        <Maximize className="w-5 h-5" />
                        <span className="text-xs font-medium">全屏</span>
                      </button>
                    </div>
                  </div>

                  {layout === 'full-screen' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3"
                    >
                      <label className="text-sm font-medium text-slate-600 block">密集度</label>
                      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                        {(['loose', 'moderate', 'dense'] as const).map((d) => (
                          <button
                            key={d}
                            onClick={() => setDensity(d)}
                            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                              density === d 
                                ? 'bg-white text-blue-600 shadow-sm border border-slate-200' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {d === 'loose' ? '宽松' : d === 'moderate' ? '适中' : '密集'}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {watermarkType === 'text' ? (
                    <>
                      <div>
                        <label className="text-sm font-medium text-slate-600 mb-2 block">水印文字</label>
                        <input 
                          type="text" 
                          value={watermarkText}
                          onChange={(e) => setWatermarkText(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-600 mb-2 block">字体选择</label>
                        <select 
                          value={fontFamily}
                          onChange={(e) => setFontFamily(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white"
                        >
                          <option value="song">宋体</option>
                          <option value="kai">楷体</option>
                          <option value="xingkai">行楷</option>
                          <option value="yahei">微软雅黑</option>
                          <option value="times-roman">Times New Roman</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm font-medium text-slate-600">字体大小</label>
                          <span className="text-sm font-bold text-blue-600">{fontSize}px</span>
                        </div>
                        <input 
                          type="range" 
                          min="10" max="200" 
                          value={fontSize}
                          onChange={(e) => setFontSize(parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium text-slate-600 mb-2 block">上传水印图片</label>
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => document.getElementById('image-upload')?.click()}
                            className="px-4 py-3 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-all text-sm text-slate-600 flex-1"
                          >
                            {imageFile ? imageFile.name : '点击选择图片'}
                          </button>
                          <input 
                            id="image-upload"
                            type="file" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setImageFile(file);
                                const url = URL.createObjectURL(file);
                                setImagePreview(url);
                                
                                // 获取图片原始尺寸以确保预览准确
                                const img = new Image();
                                img.onload = () => {
                                  setImageSize({ width: img.width, height: img.height });
                                };
                                img.src = url;
                              }
                            }}
                            className="hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm font-medium text-slate-600">图片缩放</label>
                          <span className="text-sm font-bold text-blue-600">{Math.round(imageScale * 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.1" max="2" step="0.05" 
                          value={imageScale}
                          onChange={(e) => setImageScale(parseFloat(e.target.value))}
                          className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-slate-600">透明度</label>
                      <span className="text-sm font-bold text-blue-600">{Math.round(opacity * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.01" 
                      value={opacity}
                      onChange={(e) => setOpacity(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-slate-600">旋转角度</label>
                      <span className="text-sm font-bold text-blue-600">{angle}°</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="360" 
                      value={angle}
                      onChange={(e) => setAngle(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  {watermarkType === 'text' && (
                    <div>
                      <label className="text-sm font-medium text-slate-600 mb-2 block">水印颜色</label>
                      <div className="flex gap-3">
                        <input 
                          type="color" 
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="w-12 h-12 rounded-xl border border-slate-200 cursor-pointer overflow-hidden p-1 bg-white"
                        />
                        <input 
                          type="text" 
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                <p className="text-sm text-blue-700 leading-relaxed">
                  <strong>💡 提示：</strong> 我们的水印是直接注入 PDF 渲染指令层的，无法被简单的“橡皮擦”工具抹除，安全性远高于图片覆盖。
                </p>
              </div>

              {/* PDF Metadata Section */}
              {pdfMetadata && (
                <section className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-slate-900">
                      <Info className="w-5 h-5 text-blue-600" />
                      <h2 className="font-bold">文件深入分析</h2>
                    </div>
                    <button 
                      onClick={() => setShowFullMetadata(!showFullMetadata)}
                      className="text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      {showFullMetadata ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    {/* 核心指标网格 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-500 text-[10px] font-medium mb-1">
                          <FileText className="w-3 h-3" /> 页面数量
                        </div>
                        <div className="text-sm font-bold text-slate-900">{pdfMetadata.page_count} 页</div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-500 text-[10px] font-medium mb-1">
                          <Maximize className="w-3 h-3" /> 文件大小
                        </div>
                        <div className="text-sm font-bold text-slate-900">
                          {pdfMetadata.file_size > 1024 * 1024 
                            ? (pdfMetadata.file_size / (1024 * 1024)).toFixed(2) + ' MB'
                            : (pdfMetadata.file_size / 1024).toFixed(2) + ' KB'}
                        </div>
                      </div>
                    </div>

                    {/* 资源统计 */}
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">资源统计</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                          <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                            <Type className="w-3 h-3" /> 字体
                          </div>
                          <span className="text-[11px] font-bold">{pdfMetadata.total_fonts}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                          <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                            <ImageIcon className="w-3 h-3" /> 图片
                          </div>
                          <span className="text-[11px] font-bold">{pdfMetadata.total_images}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                          <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                            <LinkIcon className="w-3 h-3" /> 链接
                          </div>
                          <span className="text-[11px] font-bold">{pdfMetadata.total_links}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                          <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                            <Layers className="w-3 h-3" /> 注释
                          </div>
                          <span className="text-[11px] font-bold">{pdfMetadata.total_annots}</span>
                        </div>
                      </div>
                    </div>

                    {/* 文档特征标签 */}
                    <div className="flex flex-wrap gap-2">
                      {pdfMetadata.is_scanned && (
                        <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-md text-[10px] font-bold flex items-center gap-1 border border-amber-100">
                          <Eye className="w-3 h-3" /> 扫描件
                        </span>
                      )}
                      {pdfMetadata.has_forms && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold flex items-center gap-1 border border-blue-100">
                          <FileText className="w-3 h-3" /> 包含表单
                        </span>
                      )}
                      {pdfMetadata.has_signatures && (
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-bold flex items-center gap-1 border border-emerald-100">
                          <Shield className="w-3 h-3" /> 已数字签名
                        </span>
                      )}
                      {!pdfMetadata.is_scanned && (
                        <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-bold flex items-center gap-1 border border-indigo-100">
                          <Type className="w-3 h-3" /> 原生文本
                        </span>
                      )}
                    </div>

                    {/* 权限与安全 */}
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">权限与安全</h3>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">加密状态</span>
                          <span className={pdfMetadata.is_encrypted ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>
                            {pdfMetadata.is_encrypted ? `已加密 (${pdfMetadata.version})` : "标准未加密"}
                          </span>
                        </div>
                        <div className="pt-2 grid grid-cols-2 gap-y-2 border-t border-slate-200">
                          <div className="flex items-center gap-1.5 text-[10px]">
                            {pdfMetadata.permissions.print ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-slate-300" />}
                            <span className={pdfMetadata.permissions.print ? "text-slate-700" : "text-slate-400"}>打印</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            {pdfMetadata.permissions.copy ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-slate-300" />}
                            <span className={pdfMetadata.permissions.copy ? "text-slate-700" : "text-slate-400"}>复制内容</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            {pdfMetadata.permissions.modify ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-slate-300" />}
                            <span className={pdfMetadata.permissions.modify ? "text-slate-700" : "text-slate-400"}>修改文档</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            {pdfMetadata.permissions.form ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-slate-300" />}
                            <span className={pdfMetadata.permissions.form ? "text-slate-700" : "text-slate-400"}>填写表单</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 详细元数据 (可折叠) */}
                    {showFullMetadata && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-3 pt-2 border-t border-slate-100"
                      >
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">文档属性</h3>
                        <div className="space-y-2">
                          {pdfMetadata.metadata.title && (
                            <div className="flex gap-2">
                              <Tag className="w-3 h-3 text-slate-400 mt-0.5" />
                              <div className="flex-1">
                                <div className="text-[9px] text-slate-400">标题</div>
                                <div className="text-[11px] text-slate-700 font-medium leading-tight">{pdfMetadata.metadata.title}</div>
                              </div>
                            </div>
                          )}
                          {pdfMetadata.metadata.author && (
                            <div className="flex gap-2">
                              <User className="w-3 h-3 text-slate-400 mt-0.5" />
                              <div className="flex-1">
                                <div className="text-[9px] text-slate-400">作者</div>
                                <div className="text-[11px] text-slate-700 font-medium leading-tight">{pdfMetadata.metadata.author}</div>
                              </div>
                            </div>
                          )}
                          {(pdfMetadata.metadata.creationDate || pdfMetadata.metadata.modDate) && (
                            <div className="flex gap-2">
                              <Calendar className="w-3 h-3 text-slate-400 mt-0.5" />
                              <div className="flex-1">
                                <div className="text-[9px] text-slate-400">创建/修改时间</div>
                                <div className="text-[11px] text-slate-700 font-medium leading-tight">
                                  {pdfMetadata.metadata.creationDate || "未知"}
                                </div>
                              </div>
                            </div>
                          )}
                          {pdfMetadata.metadata.producer && (
                            <div className="flex gap-2">
                              <Settings className="w-3 h-3 text-slate-400 mt-0.5" />
                              <div className="flex-1">
                                <div className="text-[9px] text-slate-400">制作程序</div>
                                <div className="text-[11px] text-slate-700 font-medium leading-tight truncate">{pdfMetadata.metadata.producer}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Preview Area */}
            <div className="lg:col-span-8">
              <div className="bg-slate-200 rounded-[2rem] p-8 min-h-[600px] flex items-center justify-center relative overflow-hidden border border-slate-300">
                <div className="absolute top-4 left-6 flex items-center gap-2 text-slate-500 text-sm font-medium">
                  <Eye className="w-4 h-4" /> 实时预览 (第 1 页)
                </div>
                
                {loading && (
                  <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-[2rem]">
                    <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      <span className="font-medium text-slate-900">正在重构预览...</span>
                    </div>
                  </div>
                )}

                <div className="bg-white shadow-2xl rounded-sm max-w-full overflow-hidden transition-transform duration-500 relative">
                  {previewUrl ? (
                    <>
                      <img 
                        ref={previewRef}
                        src={previewUrl} 
                        alt="PDF Preview" 
                        className="max-h-[70vh] w-auto object-contain"
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          setPreviewSize({ width: img.clientWidth, height: img.clientHeight });
                        }}
                      />
                      {/* 交互式水印层 (仅在单点模式下显示拖拽) */}
                      {layout === 'single' && pageInfo && previewSize && customPosition && (
                        <motion.div
                          onMouseDown={(e) => {
                            // 自定义拖拽逻辑，解决 framer-motion 拖拽结束时的跳动问题
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const startX = e.clientX;
                            const startY = e.clientY;
                            // 确保从当前状态读取最新位置
                            const startPdfX = customPosition?.x ?? 0;
                            const startPdfY = customPosition?.y ?? 0;
                            
                            const scaleX = pageInfo.width / previewSize.width;
                            const scaleY = pageInfo.height / previewSize.height;

                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              moveEvent.preventDefault();
                              const dx = moveEvent.clientX - startX;
                              const dy = moveEvent.clientY - startY;
                              
                              setCustomPosition({
                                x: startPdfX + dx * scaleX,
                                y: startPdfY + dy * scaleY
                              });
                            };

                            const handleMouseUp = () => {
                              document.removeEventListener('mousemove', handleMouseMove);
                              document.removeEventListener('mouseup', handleMouseUp);
                            };

                            document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                          }}
                          style={{
                            position: 'absolute',
                            left: (customPosition.x / pageInfo.width) * previewSize.width,
                            top: (customPosition.y / pageInfo.height) * previewSize.height,
                            x: '-50%',
                            y: '-50%',
                            rotate: angle,
                            fontSize: (fontSize / pageInfo.width) * previewSize.width,
                            color: color,
                            opacity: opacity,
                            cursor: 'move',
                            whiteSpace: 'nowrap',
                            userSelect: 'none',
                            zIndex: 20,
                            padding: '10px',
                            border: '2px solid #3b82f6',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          }}
                        >
                          {watermarkType === 'text' ? (
                            <span style={{ fontFamily: getCssFontFamily(fontFamily) }}>{watermarkText}</span>
                          ) : (
                            imagePreview ? (
                              <img 
                                src={imagePreview} 
                                alt="Watermark" 
                                style={{ 
                                  width: (imageSize.width * imageScale / pageInfo.width) * previewSize.width,
                                  height: 'auto',
                                  display: 'block'
                                }} 
                              />
                            ) : (
                              <div className="w-20 h-20 bg-slate-200 border-2 border-dashed border-slate-400 flex items-center justify-center text-[10px] text-slate-500">
                                未上传图片
                              </div>
                            )
                          )}
                           
                           {/* 旋转手柄 */}
                           <div 
                             className="absolute -top-10 left-1/2 -translate-x-1/2 p-1.5 bg-white border-2 border-blue-500 rounded-full cursor-pointer hover:bg-blue-50 transition-colors shadow-lg"
                             onMouseDown={(e) => {
                               e.stopPropagation();
                               const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                               if (!rect) return;
                               const centerX = rect.left + rect.width / 2;
                               const centerY = rect.top + rect.height / 2;
                               
                               const handleMouseMove = (moveEvent: MouseEvent) => {
                                 const dx = moveEvent.clientX - centerX;
                                 const dy = moveEvent.clientY - centerY;
                                 const newAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
                                 setAngle(Math.round(newAngle));
                               };
                               
                               const handleMouseUp = () => {
                                 document.removeEventListener('mousemove', handleMouseMove);
                                 document.removeEventListener('mouseup', handleMouseUp);
                               };
                               
                               document.addEventListener('mousemove', handleMouseMove);
                               document.addEventListener('mouseup', handleMouseUp);
                             }}
                           >
                             <RotateCw className="w-4 h-4 text-blue-600" />
                           </div>

                           {/* 缩放手柄 */}
                           <div 
                             className="absolute -bottom-3 -right-3 p-1.5 bg-white border-2 border-blue-500 rounded-lg cursor-nwse-resize hover:bg-blue-50 transition-colors shadow-lg"
                             onMouseDown={(e) => {
                               e.stopPropagation();
                               const startX = e.clientX;
                               const startY = e.clientY;
                               const startVal = watermarkType === 'text' ? fontSize : imageScale;
                               
                               const handleMouseMove = (moveEvent: MouseEvent) => {
                                 const dx = moveEvent.clientX - startX;
                                 const dy = moveEvent.clientY - startY;
                                 const delta = Math.max(dx, dy);
                                 if (watermarkType === 'text') {
                                   setFontSize(Math.max(10, Math.round(startVal + delta)));
                                 } else {
                                   setImageScale(Math.max(0.1, startVal + delta / 100));
                                 }
                               };
                               
                               const handleMouseUp = () => {
                                 document.removeEventListener('mousemove', handleMouseMove);
                                 document.removeEventListener('mouseup', handleMouseUp);
                               };
                               
                               document.addEventListener('mousemove', handleMouseMove);
                               document.addEventListener('mouseup', handleMouseUp);
                             }}
                           >
                             <Scaling className="w-4 h-4 text-blue-600" />
                           </div>
                         </motion.div>
                      )}
                    </>
                  ) : (
                    <div className="w-[400px] h-[560px] flex items-center justify-center text-slate-400">
                      加载中...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
