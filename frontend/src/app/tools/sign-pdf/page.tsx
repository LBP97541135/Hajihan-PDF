"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, PenTool, Settings, Eye, Download, Loader2, Trash2, Move } from 'lucide-react';
import Link from 'next/link';
import PDFUploader from '@/components/PDFUploader';
import SignatureCanvas from 'react-signature-canvas';
import axios from 'axios';

const API_BASE = '';

export default function SignPDFPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sigX, setSigX] = useState(100);
  const [sigY, setSigY] = useState(100);
  const [sigScale, setSigScale] = useState(1.0);
  const sigCanvas = useRef<SignatureCanvas>(null);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
  };

  const clearSignature = () => {
    sigCanvas.current?.clear();
    setPreviewUrl(null);
  };

  const fetchPreview = async () => {
    if (!file || sigCanvas.current?.isEmpty()) return;
    setLoading(true);
    try {
      const sigData = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
      const formData = new FormData();
      formData.append('file', file);
      
      // 注意：这里的结构需要与后端 reconstruct 接口配合
      // 前端坐标需要映射到 PDF 坐标
      const page_modifiers = {
        "0": [
          {
            "type": "image",
            "base64": sigData?.split(',')[1],
            "x": sigX,
            "y": sigY,
            "scale": sigScale
          }
        ]
      };
      
      formData.append('page_modifiers_json', JSON.stringify(page_modifiers));

      const previewImgResponse = await axios.post(`${API_BASE}/api/preview`, formData, {
        params: { page_index: 0 },
        responseType: 'blob'
      });
      
      const url = URL.createObjectURL(previewImgResponse.data);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Failed to fetch preview:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (file) {
      const timer = setTimeout(fetchPreview, 500);
      return () => clearTimeout(timer);
    }
  }, [file, sigX, sigY, sigScale]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div className="flex items-center gap-2">
              <PenTool className="w-6 h-6 text-purple-600" />
              <h1 className="font-bold text-lg text-slate-900">电子签署</h1>
            </div>
          </div>
          {file && (
            <button className="bg-purple-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-purple-700 transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20">
              <Download className="w-4 h-4" /> 导出已签署文档
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
            <div className="lg:col-span-4 space-y-6">
              <section className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-slate-900">
                    <PenTool className="w-5 h-5 text-purple-600" />
                    <h2 className="font-bold">手写签名</h2>
                  </div>
                  <button 
                    onClick={clearSignature}
                    className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="border-2 border-slate-100 rounded-2xl bg-slate-50 mb-6">
                  <SignatureCanvas 
                    ref={sigCanvas}
                    penColor='black'
                    canvasProps={{width: 340, height: 180, className: 'sigCanvas'}}
                    onEnd={fetchPreview}
                  />
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-slate-600 flex items-center gap-1">
                        <Move className="w-3 h-3" /> 水平位置 (X)
                      </label>
                      <span className="text-sm font-bold text-purple-600">{sigX}</span>
                    </div>
                    <input 
                      type="range" min="0" max="600" 
                      value={sigX}
                      onChange={(e) => setSigX(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-slate-600 flex items-center gap-1">
                        <Move className="w-3 h-3" /> 垂直位置 (Y)
                      </label>
                      <span className="text-sm font-bold text-purple-600">{sigY}</span>
                    </div>
                    <input 
                      type="range" min="0" max="800" 
                      value={sigY}
                      onChange={(e) => setSigY(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-slate-600">签名缩放</label>
                      <span className="text-sm font-bold text-purple-600">{Math.round(sigScale * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0.1" max="3" step="0.1" 
                      value={sigScale}
                      onChange={(e) => setSigScale(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>
                </div>
              </section>

              <div className="bg-purple-50 p-6 rounded-[2rem] border border-purple-100">
                <p className="text-sm text-purple-700 leading-relaxed">
                  <strong>✨ 贴心建议：</strong> 完成签名后，您可以拖动滑块精确调整签名在文档中的位置。点击预览图可直接预览效果。
                </p>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="bg-slate-200 rounded-[2rem] p-8 min-h-[600px] flex items-center justify-center relative border border-slate-300">
                <div className="absolute top-4 left-6 flex items-center gap-2 text-slate-500 text-sm font-medium">
                  <Eye className="w-4 h-4" /> 签署预览
                </div>
                
                {loading && (
                  <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-[2rem]">
                    <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                      <span className="font-medium text-slate-900">同步签名中...</span>
                    </div>
                  </div>
                )}

                <div className="bg-white shadow-2xl rounded-sm max-w-full overflow-hidden">
                  {previewUrl ? (
                    <img src={previewUrl} alt="PDF Preview" className="max-h-[70vh] w-auto" />
                  ) : (
                    <div className="w-[400px] h-[560px] flex items-center justify-center text-slate-400">
                      请先在左侧绘制签名
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
