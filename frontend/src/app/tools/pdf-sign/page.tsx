"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, PenTool, Settings, Eye, Download, Loader2, RotateCcw, Move } from 'lucide-react';
import Link from 'next/link';
import PDFUploader from '@/components/PDFUploader';
import SignatureCanvas from 'react-signature-canvas';
import axios from 'axios';

const API_BASE = '';

export default function SignPDFPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [xPos, setXPos] = useState(100);
  const [yPos, setYPos] = useState(100);
  const [scale, setScale] = useState(1.0);
  const sigCanvas = useRef<SignatureCanvas>(null);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
  };

  const clearSignature = () => {
    sigCanvas.current?.clear();
    setSignatureData(null);
  };

  const saveSignature = () => {
    if (sigCanvas.current) {
      const data = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      setSignatureData(data);
    }
  };

  const fetchPreview = async () => {
    if (!file || !signatureData) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const page_modifiers = {
        "0": [
          {
            "type": "image",
            "base64": signatureData,
            "x": xPos,
            "y": yPos,
            "scale": scale
          }
        ]
      };
      
      formData.append('page_modifiers_json', JSON.stringify(page_modifiers));

      const response = await axios.post(`${API_BASE}/api/preview`, formData, {
        params: { page_index: 0 },
        responseType: 'blob'
      });
      
      const url = URL.createObjectURL(response.data);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Failed to fetch preview:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (file && signatureData) {
      const timer = setTimeout(fetchPreview, 500);
      return () => clearTimeout(timer);
    }
  }, [file, signatureData, xPos, yPos, scale]);

  const handleDownload = async () => {
    if (!file || !signatureData) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const page_modifiers = {
        "0": [
          {
            "type": "image",
            "stream": signatureData,
            "x1": xPos,
            "y1": yPos,
            "x2": xPos + 150 * scale,
            "y2": yPos + 80 * scale
          }
        ]
      };
      
      formData.append('page_modifiers_json', JSON.stringify(page_modifiers));

      const response = await axios.post(`${API_BASE}/api/reconstruct`, formData, {
        responseType: 'blob'
      });
      
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `signed_${file.name}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setLoading(false);
    }
  };

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
              <h1 className="font-bold text-lg text-slate-900">签署 PDF</h1>
            </div>
          </div>
          {file && signatureData && (
            <button 
              onClick={handleDownload}
              className="bg-purple-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-purple-700 transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20"
            >
              <Download className="w-4 h-4" /> 导出已签署 PDF
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
              <section className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 text-slate-900">
                    <PenTool className="w-5 h-5 text-purple-600" />
                    <h2 className="font-bold">手写签名</h2>
                  </div>
                  <button 
                    onClick={clearSignature}
                    className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all"
                    title="重置"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                  <SignatureCanvas 
                    ref={sigCanvas}
                    penColor="black"
                    canvasProps={{width: 400, height: 200, className: 'sigCanvas w-full cursor-crosshair'}}
                    onEnd={saveSignature}
                  />
                </div>
                <p className="text-center text-xs text-slate-400 mt-3 italic">请在上方区域绘制您的签名</p>
              </section>

              {signatureData && (
                <motion.section 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-6 text-slate-900">
                    <Move className="w-5 h-5 text-purple-600" />
                    <h2 className="font-bold">位置与缩放</h2>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-slate-600">水平位置 (X)</label>
                        <span className="text-sm font-bold text-purple-600">{xPos}</span>
                      </div>
                      <input 
                        type="range" min="0" max="600" 
                        value={xPos} onChange={(e) => setXPos(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-slate-600">垂直位置 (Y)</label>
                        <span className="text-sm font-bold text-purple-600">{yPos}</span>
                      </div>
                      <input 
                        type="range" min="0" max="800" 
                        value={yPos} onChange={(e) => setYPos(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-slate-600">缩放比例</label>
                        <span className="text-sm font-bold text-purple-600">{Math.round(scale * 100)}%</span>
                      </div>
                      <input 
                        type="range" min="0.1" max="3" step="0.1"
                        value={scale} onChange={(e) => setScale(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                    </div>
                  </div>
                </motion.section>
              )}

              <div className="bg-purple-50 p-6 rounded-[2rem] border border-purple-100">
                <p className="text-sm text-purple-700 leading-relaxed">
                  <strong>🖋️ 矢量签署：</strong> 签名将作为高分辨率图像注入 PDF 指令流。您可以随意调整位置和大小，导出后依然保持极高的清晰度。
                </p>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="bg-slate-200 rounded-[2rem] p-8 min-h-[600px] flex items-center justify-center relative overflow-hidden border border-slate-300">
                <div className="absolute top-4 left-6 flex items-center gap-2 text-slate-500 text-sm font-medium">
                  <Eye className="w-4 h-4" /> 签署预览
                </div>
                
                {loading && (
                  <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-[2rem]">
                    <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                      <span className="font-medium text-slate-900">正在应用签名...</span>
                    </div>
                  </div>
                )}

                <div className="bg-white shadow-2xl rounded-sm max-w-full overflow-hidden">
                  {previewUrl ? (
                    <img 
                      src={previewUrl} 
                      alt="PDF Preview" 
                      className="max-h-[70vh] w-auto object-contain"
                    />
                  ) : (
                    <div className="w-[400px] h-[560px] flex items-center justify-center text-slate-400">
                      {signatureData ? "正在生成预览..." : "等待上传 PDF 并完成签名..."}
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
