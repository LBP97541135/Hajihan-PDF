"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Droplets, 
  Eraser, 
  Info, 
  FileEdit, 
  PenTool, 
  Upload,
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock
} from 'lucide-react';

import Link from 'next/link';

const tools = [
  {
    id: 'add-watermark',
    name: '增加水印',
    desc: '在 PDF 源码层织入安全水印',
    icon: <Droplets className="w-6 h-6 text-blue-500" />,
    color: 'bg-blue-50',
    href: '/tools/add-watermark'
  },
  {
    id: 'remove-watermark',
    name: '去除水印',
    desc: '基于对象分析的无损去水印',
    icon: <Eraser className="w-6 h-6 text-red-500" />,
    color: 'bg-red-50',
    href: '/tools/remove-watermark'
  },
  {
    id: 'info-query',
    name: '信息查询',
    desc: '深度解析 PDF 元数据与结构',
    icon: <Info className="w-6 h-6 text-emerald-500" />,
    color: 'bg-emerald-50',
    href: '/tools/info-query'
  },
  {
    id: 'pdf-annotate',
    name: 'PDF 标注',
    desc: '交互式画笔、高亮与文字备注',
    icon: <FileEdit className="w-6 h-6 text-amber-500" />,
    color: 'bg-amber-50',
    href: '/tools/pdf-annotate'
  },
  {
    id: 'pdf-sign',
    name: '签署 PDF',
    desc: '原生手写签名与精准定位',
    icon: <PenTool className="w-6 h-6 text-indigo-500" />,
    color: 'bg-indigo-50',
    href: '/tools/pdf-sign'
  }
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="font-bold text-xl tracking-tight">Hajihan <span className="text-blue-600">PDF</span></span>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#" className="hover:text-blue-600 transition-colors">功能</a>
            <a href="#" className="hover:text-blue-600 transition-colors">安全</a>
            <a href="#" className="bg-slate-900 text-white px-4 py-2 rounded-full hover:bg-slate-800 transition-all">
              立即开始
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-blue-50 text-blue-600 text-sm font-semibold mb-6 border border-blue-100">
              专业级 PDF 源码重构引擎
            </span>
            <h1 className="text-6xl font-extrabold tracking-tight mb-8 text-slate-900 leading-tight">
              重新定义您的 <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                PDF 编辑体验
              </span>
            </h1>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
              基于底层源码分析与重构技术，为您提供比传统工具更纯净、更安全、更高效的 PDF 处理方案。
            </p>
          </motion.div>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-32">
          {tools.map((tool, index) => (
            <Link key={tool.id} href={tool.href}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="group bg-white p-8 rounded-3xl border border-slate-200 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer relative overflow-hidden h-full"
              >
                <div className={`${tool.color} w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  {tool.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-blue-600 transition-colors">{tool.name}</h3>
                <p className="text-slate-500 leading-relaxed mb-6">{tool.desc}</p>
                <div className="flex items-center text-blue-600 font-semibold gap-2">
                  进入工具 <ArrowRight className="w-4 h-4" />
                </div>
              </motion.div>
            </Link>
          ))}
        </div>

        {/* Features Section */}
        <div className="bg-slate-900 rounded-[3rem] p-16 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full -mr-20 -mt-20"></div>
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
              </div>
              <h4 className="text-xl font-bold">极致安全</h4>
              <p className="text-slate-400 leading-relaxed">
                所有处理均在您的服务器本地完成，不留任何痕迹，完美保护您的隐私。
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-amber-400" />
              </div>
              <h4 className="text-xl font-bold">重构引擎</h4>
              <p className="text-slate-400 leading-relaxed">
                不同于传统的叠加式修改，我们直接重写 PDF 渲染指令，生成的文档更纯净。
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <Lock className="w-6 h-6 text-emerald-400" />
              </div>
              <h4 className="text-xl font-bold">加密保护</h4>
              <p className="text-slate-400 leading-relaxed">
                支持 AES-256 高强度加密，为您的文档提供银行级的安全防护。
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-12 text-center text-slate-500">
        <p>© 2025 Hajihan PDF Pro. Designed with excellence for professionals.</p>
      </footer>
    </div>
  );
}
