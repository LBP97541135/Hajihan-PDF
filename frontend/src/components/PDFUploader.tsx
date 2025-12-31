"use client";

import React, { useCallback, useState } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PDFUploaderProps {
  onFileSelect: (file: File) => void;
}

export default function PDFUploader({ onFileSelect }: PDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateAndSelect = (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('只支持 PDF 文件格式');
      return;
    }
    if (file.size > 20 * 1024 * 1024) { // 20MB limit
      setError('文件大小不能超过 20MB');
      return;
    }
    setError(null);
    onFileSelect(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSelect(file);
  }, [onFileSelect]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
  };

  return (
    <div className="w-full">
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-[2.5rem] p-12 transition-all duration-300
          ${isDragging 
            ? 'border-blue-500 bg-blue-50/50 scale-[1.02]' 
            : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-slate-50/50'}
        `}
      >
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center mb-6 text-blue-600">
            <Upload className="w-10 h-10" />
          </div>
          
          <h3 className="text-2xl font-bold text-slate-900 mb-2">
            选择或拖拽 PDF 文件
          </h3>
          <p className="text-slate-500 mb-8 max-w-sm">
            支持 20MB 以内的 PDF 文档，所有处理均在服务器内存中完成，不保留任何副本。
          </p>
          
          <div className="flex items-center gap-3 text-sm font-medium text-slate-400">
            <FileText className="w-4 h-4" />
            <span>仅限 .pdf 格式</span>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-red-500 bg-red-50 px-4 py-2 rounded-full border border-red-100 shadow-sm"
            >
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-bold">{error}</span>
              <button onClick={() => setError(null)} className="ml-1 hover:bg-red-100 rounded-full p-1">
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      <div className="mt-8 grid grid-cols-3 gap-6">
        {[
          { label: '隐私安全', desc: '端到端加密传输' },
          { label: '极速处理', desc: '毫秒级响应预览' },
          { label: '无损画质', desc: '矢量级 PDF 重构' },
        ].map((item, i) => (
          <div key={i} className="text-center p-4">
            <div className="font-bold text-slate-800 text-sm mb-1">{item.label}</div>
            <div className="text-slate-400 text-xs">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
