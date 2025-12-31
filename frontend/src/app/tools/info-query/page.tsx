"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Info, FileText, Calendar, Shield, Hash, Layout, Download, Loader2, Type, Image as ImageIcon, Link as LinkIcon, Lock, CheckCircle2, XCircle, User, Tag, Settings, Layers, Eye, Maximize } from 'lucide-react';
import Link from 'next/link';
import PDFUploader from '@/components/PDFUploader';
import axios from 'axios';

const API_BASE = '';

interface PDFInfo {
  page_count: number;
  file_size: number;
  is_encrypted: boolean;
  version: string;
  total_images: number;
  total_fonts: number;
  total_links: number;
  total_annots: number;
  has_ocg: boolean;
  has_forms: boolean;
  has_signatures: boolean;
  is_scanned: boolean;
  permissions: {
    print: boolean;
    modify: boolean;
    copy: boolean;
    annotate: boolean;
    form: boolean;
  };
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modDate?: string;
  };
  pages: {
    index: number;
    width: number;
    height: number;
  }[];
}

export default function InfoQueryPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<PDFInfo | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await axios.post(`${API_BASE}/api/pdf-info`, formData);
      setInfo(response.data);
    } catch (error) {
      console.error('Failed to fetch PDF info:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '未知';
    // PDF dates are often in format D:20231226...
    if (dateStr.startsWith('D:')) {
      const year = dateStr.substring(2, 6);
      const month = dateStr.substring(6, 8);
      const day = dateStr.substring(8, 10);
      return `${year}-${month}-${day}`;
    }
    return dateStr;
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
              <Info className="w-6 h-6 text-emerald-600" />
              <h1 className="font-bold text-lg text-slate-900">PDF 信息查询</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!file ? (
          <div className="max-w-2xl mx-auto mt-20">
            <PDFUploader onFileSelect={handleFileSelect} />
          </div>
        ) : (
          <div className="space-y-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                <p className="text-slate-500 font-medium">正在深度解析 PDF 结构...</p>
              </div>
            ) : info && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              >
                {/* Basic Stats */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                      <Layout className="w-8 h-8" />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 mb-1">{info.page_count}</h2>
                    <p className="text-slate-500 font-medium">总页数</p>
                    
                    <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">文件大小</span>
                        <span className="text-slate-900 font-bold">
                          {info.file_size > 1024 * 1024 
                            ? (info.file_size / (1024 * 1024)).toFixed(2) + ' MB'
                            : (info.file_size / 1024).toFixed(2) + ' KB'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">PDF 版本</span>
                        <span className="text-slate-900 font-bold">{info.version}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">安全状态</span>
                        <span className={`font-bold ${info.is_encrypted ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {info.is_encrypted ? '已加密' : '标准未加密'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                      {info.is_scanned && (
                        <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-md text-[10px] font-bold flex items-center gap-1 border border-amber-100">
                          <Eye className="w-3 h-3" /> 扫描件
                        </span>
                      )}
                      {info.has_forms && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold flex items-center gap-1 border border-blue-100">
                          <FileText className="w-3 h-3" /> 包含表单
                        </span>
                      )}
                      {info.has_signatures && (
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-bold flex items-center gap-1 border border-emerald-100">
                          <Shield className="w-3 h-3" /> 已数字签名
                        </span>
                      )}
                      {!info.is_scanned && (
                        <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-bold flex items-center gap-1 border border-indigo-100">
                          <Type className="w-3 h-3" /> 原生文本
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">权限清单</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <PermissionRow label="允许打印" allowed={info.permissions.print} />
                      <PermissionRow label="允许复制内容" allowed={info.permissions.copy} />
                      <PermissionRow label="允许修改文档" allowed={info.permissions.modify} />
                      <PermissionRow label="允许填写表单" allowed={info.permissions.form} />
                    </div>
                  </div>

                  <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-emerald-200">
                    <h3 className="font-bold text-lg mb-2">安全承诺</h3>
                    <p className="text-emerald-50 text-sm leading-relaxed opacity-90">
                      该解析过程完全在服务器内存中完成，不保留任何物理文件，确保您的商业机密万无一失。
                    </p>
                  </div>
                </div>

                {/* Metadata Details */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-8 text-slate-900">
                      <FileText className="w-6 h-6 text-emerald-600" />
                      <h2 className="text-xl font-bold">文档画像</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <InfoItem icon={Tag} label="标题" value={info.metadata.title || file.name} />
                      <InfoItem icon={User} label="作者" value={info.metadata.author || '未知'} />
                      <InfoItem icon={Calendar} label="创建日期" value={formatDate(info.metadata.creationDate)} />
                      <InfoItem icon={Calendar} label="修改日期" value={formatDate(info.metadata.modDate)} />
                      <InfoItem icon={Settings} label="生成工具" value={info.metadata.producer || '未知'} />
                      <InfoItem icon={User} label="创作者" value={info.metadata.creator || '未知'} />
                    </div>

                    <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-slate-100">
                      <StatItem icon={Type} label="字体" count={info.total_fonts} />
                      <StatItem icon={ImageIcon} label="图片" count={info.total_images} />
                      <StatItem icon={LinkIcon} label="链接" count={info.total_links} />
                      <StatItem icon={Layers} label="注释" count={info.total_annots} />
                    </div>
                  </div>

                  {/* Page Dimensions */}
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-8 text-slate-900">
                      <Maximize className="w-6 h-6 text-emerald-600" />
                      <h2 className="text-xl font-bold">页面尺寸详情</h2>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {info.pages.slice(0, 12).map((page) => (
                        <div key={page.index} className="px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">PAGE {page.index + 1}</p>
                          <p className="text-sm font-bold text-slate-700">{Math.round(page.width)} × {Math.round(page.height)}</p>
                        </div>
                      ))}
                      {info.page_count > 12 && (
                        <div className="px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center text-slate-400 text-xs italic">
                          ... 以及其余 {info.page_count - 12} 页
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function PermissionRow({ label, allowed }: { label: string, allowed: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
      <span className="text-slate-600 font-medium">{label}</span>
      {allowed ? (
        <span className="flex items-center gap-1 text-emerald-600 font-bold">
          <CheckCircle2 className="w-3 h-3" /> 允许
        </span>
      ) : (
        <span className="flex items-center gap-1 text-slate-400 font-bold">
          <XCircle className="w-3 h-3" /> 禁止
        </span>
      )}
    </div>
  );
}

function StatItem({ icon: Icon, label, count }: { icon: any, label: string, count: number }) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 bg-slate-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-2">
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
      <p className="text-lg font-black text-slate-900">{count}</p>
    </div>
  );
}

interface InfoItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

function InfoItem({ icon: Icon, label, value }: InfoItemProps) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-slate-900 font-semibold break-all">{value}</p>
      </div>
    </div>
  );
}
