"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Eraser, Settings, Eye, Download, Loader2, Plus, Trash2, Search, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import PDFUploader from '@/components/PDFUploader';
import axios from 'axios';

const API_BASE = '';

export default function RemoveWatermarkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [removeText, setRemoveText] = useState('');
  const [removeXObject, setRemoveXObject] = useState('');
  const [targetTexts, setTargetTexts] = useState<any[]>([]);
  const [targetXObjects, setTargetXObjects] = useState<any[]>([]);
  const [targetDrawings, setTargetDrawings] = useState<any[]>([]);
  const [targetWidgets, setTargetWidgets] = useState<any[]>([]);
  const [targetLinks, setTargetLinks] = useState<any[]>([]);
  const [interactiveElements, setInteractiveElements] = useState<any[]>([]);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [pageRect, setPageRect] = useState<number[]>([0, 0, 0, 0]);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const imageRef = React.useRef<HTMLImageElement>(null);
  
  const [detectedTexts, setDetectedTexts] = useState<string[]>([]);
  const [detectedImages, setDetectedImages] = useState<string[]>([]);
  const [detectedDrawings, setDetectedDrawings] = useState<string[]>([]);
  const [suggestedWatermarks, setSuggestedWatermarks] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setCurrentPage(0);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const infoResponse = await axios.post(`${API_BASE}/api/pdf-info`, formData);
      setTotalPages(infoResponse.data.page_count);
    } catch (error) {
      console.error('Failed to get PDF info:', error);
    }
  };

  const analyzeFile = async (selectedFile: File, pageIdx: number, isFirstLoad: boolean = false) => {
    if (isFirstLoad) {
      setDetectedTexts([]);
      setDetectedImages([]);
      setDetectedDrawings([]);
      setSuggestedWatermarks([]);
    }
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await axios.post(`${API_BASE}/api/analyze`, formData, {
        params: { 
          page_index: pageIdx,
          analyze_all: isFirstLoad 
        }
      });
      setDetectedTexts(response.data.texts);
      setDetectedImages(response.data.image_ids);
      setDetectedDrawings(response.data.drawing_ids || []);
      setInteractiveElements(response.data.interactive_elements || []);
      setPageSize({ 
        width: response.data.page_width || 0, 
        height: response.data.page_height || 0 
      });
      setPageRect(response.data.page_rect || [0, 0, 0, 0]);
      if (response.data.suggested_watermarks) {
        setSuggestedWatermarks(response.data.suggested_watermarks);
      }
    } catch (error) {
      console.error('Failed to analyze page:', error);
    }
  };

  const addTargetText = () => {
    const keyword = removeText.trim();
    if (keyword) {
      const exists = targetTexts.some(t => typeof t === 'string' ? t === keyword : t.content === keyword);
      if (!exists) {
        // 尝试在当前页面的交互元素中找到匹配该文本的元素
        // 优先寻找完全匹配的元素，这样可以带上精确的 bbox 和 id
        const matchingElement = interactiveElements.find(
          el => el.type === 'text' && el.content === keyword
        );

        if (matchingElement) {
          // 如果找到了完全匹配，带上 id, content, bbox, color, font 等所有元数据
          // 这样后端可以通过 id 100% 锁定该元素的物理位置和属性
          setTargetTexts([...targetTexts, { 
            id: matchingElement.id, 
            content: matchingElement.content, 
            bbox: matchingElement.bbox, 
            color: matchingElement.color,
            font: matchingElement.font,
            size: matchingElement.size,
            page: currentPage,
            type: 'text'
          }]);
        } else {
          // 如果没找到完全匹配（可能是跨 span 的文本，或者用户只想删某个片段）
          // 则只传字符串，不带 bbox，防止误杀整个 span
          setTargetTexts([...targetTexts, keyword]);
        }
        setRemoveText('');
      }
    }
  };

  const removeTargetText = (item: any) => {
    const id = typeof item === 'object' ? item.id : item;
    setTargetTexts(targetTexts.filter(t => (typeof t === 'object' ? t.id !== id : t !== id)));
  };

  const addTargetXObject = () => {
    if (removeXObject) {
      const id = removeXObject;
      const exists = targetXObjects.some(t => typeof t === 'object' ? t.id === id : t === id);
      if (!exists) {
        setTargetXObjects([...targetXObjects, { 
          id: id, 
          page: currentPage, 
          type: 'image' 
        }]);
        setRemoveXObject('');
      }
    }
  };

  const removeTargetXObject = (item: any) => {
    const id = typeof item === 'object' ? item.id : item;
    setTargetXObjects(targetXObjects.filter(t => (typeof t === 'object' ? t.id !== id : t !== id)));
  };

  const removeTargetDrawing = (item: any) => {
    const id = typeof item === 'object' ? item.id : item;
    setTargetDrawings(targetDrawings.filter(t => (typeof t === 'object' ? t.id !== id : t !== id)));
  };

  const removeTargetWidget = (item: any) => {
    const id = typeof item === 'object' ? item.id : item;
    setTargetWidgets(targetWidgets.filter(t => (typeof t === 'object' ? t.id !== id : t !== id)));
  };

  const removeTargetLink = (item: any) => {
    const id = typeof item === 'object' ? item.id : item;
    setTargetLinks(targetLinks.filter(t => (typeof t === 'object' ? t.id !== id : t !== id)));
  };

  const toggleElementSelection = (element: any) => {
    const { type, id, content, bbox, page } = element;
    if (type === 'text') {
      const isSelected = targetTexts.some(t => 
        typeof t === 'object' ? t.id === id : t === content
      );
      if (isSelected) {
        setTargetTexts(targetTexts.filter(t => 
          !(typeof t === 'object' ? t.id === id : t === content)
        ));
      } else {
        setTargetTexts([...targetTexts, { 
          id, 
          content, 
          bbox, 
          color: element.color,
          font: element.font,
          size: element.size,
          page 
        }]);
      }
    } else if (type === 'image') {
      if (targetXObjects.some(t => typeof t === 'object' ? t.id === id : t === id)) {
        setTargetXObjects(targetXObjects.filter(t => (typeof t === 'object' ? t.id !== id : t !== id)));
      } else {
        setTargetXObjects([...targetXObjects, { id, page, type: 'image' }]);
      }
    } else if (type === 'drawing') {
      if (targetDrawings.some(t => typeof t === 'object' ? t.id === id : t === id)) {
        setTargetDrawings(targetDrawings.filter(t => (typeof t === 'object' ? t.id !== id : t !== id)));
      } else {
        setTargetDrawings([...targetDrawings, { id, page, type: 'drawing' }]);
      }
    } else if (type === 'widget') {
      if (targetWidgets.some(t => typeof t === 'object' ? t.id === id : t === id)) {
        setTargetWidgets(targetWidgets.filter(t => (typeof t === 'object' ? t.id !== id : t !== id)));
      } else {
        setTargetWidgets([...targetWidgets, { id, page, type: 'widget' }]);
      }
    } else if (type === 'link') {
      if (targetLinks.some(t => typeof t === 'object' ? t.id === id : t === id)) {
        setTargetLinks(targetLinks.filter(t => (typeof t === 'object' ? t.id !== id : t !== id)));
      } else {
        setTargetLinks([...targetLinks, { id, page, type: 'link' }]);
      }
    }
  };

  const isElementSelected = (element: any) => {
    const { type, id, content } = element;
    if (type === 'text') {
      return targetTexts.some(t => 
        (typeof t === 'string' && t === content) || 
        (typeof t === 'object' && t.id === id)
      );
    }
    if (type === 'image') return targetXObjects.some(t => typeof t === 'object' ? t.id === id : t === id);
    if (type === 'drawing') return targetDrawings.some(t => typeof t === 'object' ? t.id === id : t === id);
    if (type === 'widget') return targetWidgets.some(t => typeof t === 'object' ? t.id === id : t === id);
    if (type === 'link') return targetLinks.some(t => typeof t === 'object' ? t.id === id : t === id);
    return false;
  };

  const [isFirstAnalysis, setIsFirstAnalysis] = useState(true);

  useEffect(() => {
    if (file) {
      analyzeFile(file, currentPage, isFirstAnalysis);
      if (isFirstAnalysis) setIsFirstAnalysis(false);
    }
  }, [file, currentPage]);

  useEffect(() => {
    if (!file) setIsFirstAnalysis(true);
  }, [file]);

  const abortControllerRef = React.useRef<AbortController | null>(null);
  
  const fetchPreview = async () => {
    if (!file) return;
    
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const remove_targets = {
        text: targetTexts,
        xobjects: targetXObjects,
        drawings: targetDrawings,
        widgets: targetWidgets,
        links: targetLinks
      };
      
      formData.append('remove_targets_json', JSON.stringify(remove_targets));
      formData.append('page_modifiers_json', JSON.stringify({}));

      const response = await axios.post(`${API_BASE}/api/preview`, formData, {
        params: { page_index: currentPage },
        responseType: 'blob',
        signal: abortControllerRef.current.signal
      });
      
      const url = URL.createObjectURL(response.data);
      setPreviewUrl(url);
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('Request canceled:', error.message);
      } else {
        console.error('Failed to fetch preview:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (file) {
      // 缩短防抖时间到 200ms
      const timer = setTimeout(fetchPreview, 200);
      return () => clearTimeout(timer);
    }
  }, [file, targetTexts, targetXObjects, targetDrawings, targetWidgets, targetLinks, currentPage]);

  const handleDownload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('remove_targets_json', JSON.stringify({
        text: targetTexts,
        xobjects: targetXObjects,
        drawings: targetDrawings,
        widgets: targetWidgets,
        links: targetLinks
      }));
      formData.append('page_modifiers_json', JSON.stringify({}));

      const response = await axios.post(`${API_BASE}/api/reconstruct`, formData, {
        responseType: 'blob'
      });
      
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cleaned_${file.name}`);
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
              <Eraser className="w-6 h-6 text-red-600" />
              <h1 className="font-bold text-lg text-slate-900">去除水印</h1>
            </div>
          </div>
          {file && (
            <button 
              onClick={handleDownload}
              className="bg-slate-900 text-white px-6 py-2 rounded-full font-semibold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg"
            >
              <Download className="w-4 h-4" /> 导出无水印 PDF
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
              <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-8 text-slate-900">
                  <Settings className="w-6 h-6 text-red-600" />
                  <h2 className="text-lg font-bold">清除规则</h2>
                </div>
                
                <div className="space-y-8">
                  {/* 文本规则 */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" /> 文本关键词
                    </label>
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        value={removeText}
                        onChange={(e) => setRemoveText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTargetText()}
                        placeholder="手动输入要清除的文字..."
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-sm transition-all bg-slate-50/50"
                      />
                      <button 
                        onClick={addTargetText}
                        className="px-4 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {targetTexts.map((item, index) => {
                        const content = typeof item === 'string' ? item : item.content;
                        return (
                          <span 
                            key={index} 
                            className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-xl text-xs font-semibold border border-red-100 shadow-sm animate-in fade-in zoom-in duration-200"
                          >
                            <span className="max-w-[150px] truncate">{content}</span>
                            <button onClick={() => removeTargetText(item)} className="hover:bg-red-200 p-0.5 rounded-full transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* 图片规则 */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]" /> 图片元素 (XObject)
                    </label>
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        value={removeXObject}
                        onChange={(e) => setRemoveXObject(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTargetXObject()}
                        placeholder="输入图片 ID (如 Im0, Im1)..."
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-sm transition-all bg-slate-50/50"
                      />
                      <button 
                        onClick={addTargetXObject}
                        className="px-4 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-600 hover:text-white transition-all shadow-sm active:scale-95"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {targetXObjects.map((item, idx) => {
                        const id = typeof item === 'object' ? item.id : item;
                        return (
                          <span 
                            key={idx} 
                            className="flex items-center gap-2 px-3 py-2 bg-orange-50 text-orange-700 rounded-xl text-xs font-semibold border border-orange-100 shadow-sm animate-in fade-in zoom-in duration-200"
                          >
                            {id}
                            <button onClick={() => removeTargetXObject(item)} className="hover:bg-orange-200 p-0.5 rounded-full transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* 图形规则 */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]" /> 其他元素 (图形/控件/链接)
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {targetDrawings.map((item, idx) => {
                        const id = typeof item === 'object' ? item.id : item;
                        return (
                          <span 
                            key={idx} 
                            className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold border border-blue-100 shadow-sm animate-in fade-in zoom-in duration-200"
                          >
                            Drawing: {id}
                            <button 
                              onClick={() => removeTargetDrawing(item)} 
                              className="hover:bg-blue-200 p-0.5 rounded-full transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        );
                      })}
                      {targetWidgets.map((item, idx) => {
                        const id = typeof item === 'object' ? item.id : item;
                        return (
                          <span 
                            key={idx} 
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-semibold border border-indigo-100 shadow-sm animate-in fade-in zoom-in duration-200"
                          >
                            Field: {id}
                            <button 
                              onClick={() => removeTargetWidget(item)} 
                              className="hover:bg-indigo-200 p-0.5 rounded-full transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        );
                      })}
                      {targetLinks.map((item, idx) => {
                        const id = typeof item === 'object' ? item.id : item;
                        return (
                          <span 
                            key={idx} 
                            className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold border border-emerald-100 shadow-sm animate-in fade-in zoom-in duration-200"
                          >
                            Link: {id}
                            <button 
                              onClick={() => removeTargetLink(item)} 
                              className="hover:bg-emerald-200 p-0.5 rounded-full transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        );
                      })}
                      {targetDrawings.length === 0 && targetWidgets.length === 0 && targetLinks.length === 0 && (
                        <p className="text-sm text-slate-400 italic py-2">暂无非文本规则，请点击预览图中的元素添加</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6 text-slate-900">
                  <Sparkles className="w-6 h-6 text-amber-500" />
                  <h2 className="text-lg font-bold">智能建议</h2>
                </div>
                
                <div className="space-y-8 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {/* 源码级元素方块展示 */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]" /> 页面源码元素 ({interactiveElements.length})
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {interactiveElements.map((el, i) => {
                        const isSelected = isElementSelected(el);
                        return (
                          <button
                            key={i}
                            onClick={() => toggleElementSelection(el)}
                            className={`p-3 rounded-xl border transition-all text-left flex flex-col gap-1.5 group relative overflow-hidden ${
                              isSelected 
                                ? 'bg-red-50 border-red-200 ring-2 ring-red-500/20' 
                                : 'bg-slate-50 border-slate-100 hover:border-slate-300 hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                el.type === 'text' ? 'bg-blue-100 text-blue-600' :
                                el.type === 'image' ? 'bg-orange-100 text-orange-600' :
                                'bg-slate-200 text-slate-600'
                              }`}>
                                {el.type.toUpperCase()}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">{el.id.split('_').pop()}</span>
                            </div>
                            <div className="text-xs font-mono text-slate-600 truncate leading-tight">
                              {el.type === 'text' ? el.content : `Object: ${el.id}`}
                            </div>
                            {isSelected && (
                              <div className="absolute top-0 right-0 w-6 h-6 bg-red-500 text-white flex items-center justify-center rounded-bl-lg animate-in slide-in-from-top-right duration-200">
                                <Eraser className="w-3 h-3" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 跨页建议 */}
                  {suggestedWatermarks.filter(text => !targetTexts.includes(text)).length > 0 && (
                    <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 mb-6">
                      <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> 跨页重复内容 (疑似水印)
                      </h3>
                      <div className="flex flex-wrap gap-2.5">
                        {suggestedWatermarks
                          .filter(text => !targetTexts.includes(text))
                          .map((text, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              if (!targetTexts.includes(text)) {
                                setTargetTexts([...targetTexts, text]);
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl bg-white text-amber-700 text-xs font-medium hover:bg-amber-100 border border-amber-200 transition-all shadow-sm hover:shadow-md active:scale-95"
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 1. 文本类 */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]" /> 文本建议 ({detectedTexts.filter(t => !targetTexts.includes(t)).length})
                    </h3>
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="在提取到的文字中搜索..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                      />
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                    <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-1">
                      {detectedTexts
                        .filter(t => !targetTexts.some(tt => typeof tt === 'string' ? tt === t : tt.content === t) && t.toLowerCase().includes(searchText.toLowerCase()))
                        .map((text, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setTargetTexts([...targetTexts, text]);
                          }}
                          className="text-left text-sm px-4 py-3 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-700 transition-all border border-slate-100 hover:border-red-100 break-all leading-relaxed shadow-sm hover:shadow-md group relative"
                          title={text}
                        >
                          {text}
                          <Plus className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. 图片类 */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.5)]" /> 图片对象 ({detectedImages.filter(id => !targetXObjects.includes(id)).length})
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {detectedImages
                        .filter(id => !targetXObjects.includes(id))
                        .map((id, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (!targetXObjects.includes(id)) {
                              setTargetXObjects([...targetXObjects, id]);
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-orange-50 hover:text-orange-700 border border-slate-200 hover:border-orange-200 transition-all shadow-sm hover:shadow-md active:scale-95"
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. 其他类 */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" /> 其他图形 ({detectedDrawings.filter(id => !targetDrawings.includes(id)).length})
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {detectedDrawings
                        .filter(id => !targetDrawings.includes(id))
                        .map((id, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (!targetDrawings.includes(id)) {
                              setTargetDrawings([...targetDrawings, id]);
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 transition-all shadow-sm hover:shadow-md active:scale-95"
                        >
                          {id}
                        </button>
                      ))}
                      {detectedDrawings.filter(id => !targetDrawings.includes(id)).length === 0 && (
                        <p className="text-sm text-slate-400 italic py-2">未识别到更多图形元素</p>
                      )}
                    </div>
                  </div>

                  {detectedTexts.length === 0 && detectedImages.length === 0 && detectedDrawings.length === 0 && (
                    <div className="text-center py-8">
                      <Loader2 className="w-6 h-6 text-slate-300 animate-spin mx-auto mb-2" />
                      <p className="text-xs text-slate-400">正在智能分析文档内容...</p>
                    </div>
                  )}
                </div>
              </section>

              <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100">
                <p className="text-sm text-red-700 leading-relaxed">
                  <strong>✨ 源码级清除：</strong> 我们的技术不是通过“涂白”来遮盖水印，而是直接在 PDF 的渲染指令中跳过这些元素的绘制。这能确保文档背景完美无瑕，且文件体积更小。
                </p>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <div className="bg-slate-200 rounded-[2rem] p-8 min-h-[600px] flex items-center justify-center relative overflow-hidden border border-slate-300">
                <div className="absolute top-4 left-6 flex items-center gap-2 text-slate-500 text-sm font-medium">
                  <Eye className="w-4 h-4" /> 清除效果预览
                </div>
                
                {loading && (
                  <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-[2rem]">
                    <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-red-600 animate-spin" />
                      <span className="font-medium text-slate-900">正在分析渲染流...</span>
                    </div>
                  </div>
                )}

                <div className="relative group">
                  <div className="relative overflow-hidden rounded-[2.5rem] bg-white border border-slate-200 shadow-2xl transition-all duration-500 group-hover:shadow-red-500/5">
                    {previewUrl ? (
                      <div className="relative">
                        <img 
                          ref={imageRef}
                          src={previewUrl} 
                          alt="PDF Preview" 
                          className="w-full h-auto select-none"
                          onLoad={(e) => {
                            const img = e.currentTarget;
                            setImageSize({ width: img.clientWidth, height: img.clientHeight });
                          }}
                        />
                        
                        {/* 交互式元素叠加层 */}
                        <div 
                          className="absolute top-0 left-0 w-full h-full pointer-events-none"
                          style={{ 
                            width: imageSize.width, 
                            height: imageSize.height 
                          }}
                        >
                          {interactiveElements.map((el, idx) => {
                            if (!pageSize.width || !pageSize.height || !imageSize.width) return null;
                            
                            // 计算缩放比例
                            const scaleX = imageSize.width / pageSize.width;
                            const scaleY = imageSize.height / pageSize.height;
                            
                            const [x0, y0, x1, y1] = el.bbox;
                            
                            let isSelected = false;
                            if (el.type === 'text') {
                              isSelected = targetTexts.some(t => 
                                typeof t === 'object' ? t.id === el.id : t === el.content
                              );
                            } else if (el.type === 'image') {
                              isSelected = targetXObjects.some(t => typeof t === 'object' ? t.id === el.id : t === el.id);
                            } else if (el.type === 'drawing') {
                              isSelected = targetDrawings.some(t => typeof t === 'object' ? t.id === el.id : t === el.id);
                            } else if (el.type === 'widget') {
                              isSelected = targetWidgets.some(t => typeof t === 'object' ? t.id === el.id : t === el.id);
                            } else if (el.type === 'link') {
                              isSelected = targetLinks.some(t => typeof t === 'object' ? t.id === el.id : t === el.id);
                            }
                            
                            // 补偿页面原点偏移 (PDF CropBox 可能不从 0,0 开始)
                            const offsetX = pageRect[0] || 0;
                            const offsetY = pageRect[1] || 0;
                            
                            const metadataStr = el.metadata ? Object.entries(el.metadata)
                              .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                              .join('\n') : '';
                            
                            return (
                              <div
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleElementSelection(el);
                                }}
                                className={`absolute pointer-events-auto cursor-pointer transition-all duration-100 border ${
                                  isSelected 
                                    ? 'bg-white/90 border-red-500 z-20 shadow-[0_0_12px_rgba(239,68,68,0.3)] backdrop-blur-[1px]' 
                                    : 'bg-slate-400/5 border-slate-300/20 hover:bg-slate-500/20 hover:border-slate-400/40 z-10'
                                }`}
                                style={{
                                  left: (x0 - offsetX) * scaleX,
                                  top: (y0 - offsetY) * scaleY,
                                  width: (x1 - x0) * scaleX,
                                  height: (y1 - y0) * scaleY,
                                  borderRadius: '1px'
                                }}
                                title={`${el.type}: ${el.id || el.content}\n${metadataStr}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                    <div className="w-[400px] h-[560px] flex items-center justify-center text-slate-400">
                      等待上传或处理...
                    </div>
                  )}
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-6 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                    className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium"
                  >
                    <ChevronLeft className="w-5 h-5" /> 上一页
                  </button>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">
                      {currentPage + 1}
                    </span>
                    <span className="text-sm text-slate-400">/</span>
                    <span className="text-sm font-medium text-slate-500">
                      {totalPages} 页
                    </span>
                  </div>

                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage === totalPages - 1}
                    className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium"
                  >
                    下一页 <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  </div>
  );
}
