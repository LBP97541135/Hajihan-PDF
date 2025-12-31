from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import json
import base64
from utils import PDFEngine, hex_to_rgb
import fitz
from PIL import Image

app = FastAPI(title="Hajihan PDF API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/pdf-info")
async def get_pdf_info(file: UploadFile = File(...)):
    """获取 PDF 元数据和页面信息"""
    try:
        await file.seek(0)
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")
        try:
            # 统计信息
            total_images = 0
            total_annots = 0
            total_links = 0
            fonts = set()
            has_text = False
            
            for page in doc:
                total_images += len(page.get_images())
                total_annots += len(list(page.annots()))
                total_links += len(list(page.get_links()))
                if not has_text and page.get_text().strip():
                    has_text = True
                for f in page.get_fonts():
                    fonts.add(f[3]) # font name

            # 权限解析
            perm_flags = doc.permissions
            permissions = {
                "print": bool(perm_flags & fitz.PDF_PERM_PRINT),
                "modify": bool(perm_flags & fitz.PDF_PERM_MODIFY),
                "copy": bool(perm_flags & fitz.PDF_PERM_COPY),
                "annotate": bool(perm_flags & fitz.PDF_PERM_ANNOTATE),
                "form": bool(perm_flags & fitz.PDF_PERM_FORM),
            }

            # 签名检测：遍历页面寻找签名表单域
            has_signatures = False
            for page in doc:
                for field in page.widgets():
                    if field.field_type == fitz.PDF_WIDGET_TYPE_SIGNATURE:
                        has_signatures = True
                        break
                if has_signatures: break

            info = {
                "page_count": len(doc),
                "metadata": {
                    "title": doc.metadata.get("title") or "",
                    "author": doc.metadata.get("author") or "",
                    "subject": doc.metadata.get("subject") or "",
                    "keywords": doc.metadata.get("keywords") or "",
                    "creator": doc.metadata.get("creator") or "",
                    "producer": doc.metadata.get("producer") or "",
                    "creationDate": doc.metadata.get("creationDate") or "",
                    "modDate": doc.metadata.get("modDate") or "",
                },
                "file_size": len(content),
                "version": doc.pdf_get_metadata().get("encryption") if doc.is_encrypted else "Standard",
                "is_encrypted": doc.is_encrypted,
                "permissions": permissions,
                "total_images": total_images,
                "total_fonts": len(fonts),
                "total_annots": total_annots,
                "total_links": total_links,
                "has_ocg": doc.get_ocgs() is not None and len(doc.get_ocgs()) > 0,
                "has_forms": doc.is_form_pdf,
                "has_signatures": has_signatures,
                "is_scanned": not has_text and total_images > 0,
                "pages": []
            }
            for i in range(len(doc)):
                page = doc[i]
                info["pages"].append({
                    "index": i,
                    "width": page.rect.width,
                    "height": page.rect.height
                })
            return info
        finally:
            doc.close()
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/analyze")
async def analyze_page(file: UploadFile = File(...), page_index: int = 0, analyze_all: bool = False):
    """分析页面内容。如果 analyze_all 为 True，则分析所有页面并寻找共同模式"""
    try:
        await file.seek(0)
        content = await file.read()
        engine = PDFEngine(content)
        try:
            if page_index < 0 or page_index >= len(engine.src_doc):
                return JSONResponse(status_code=400, content={"error": f"Invalid page index: {page_index}"})
            
            suggested_watermarks = []
            if analyze_all:
                # 分析前 10 页寻找重复出现的文本 (疑似水印)
                common_texts = {}
                max_pages = min(len(engine.src_doc), 10)
                for i in range(max_pages):
                    p = engine.src_doc[i]
                    p_texts = set()
                    for block in p.get_text("blocks"):
                        if block[6] == 0:
                            text = block[4].strip()
                            if len(text) > 1: p_texts.add(text)
                    for t in p_texts:
                        common_texts[t] = common_texts.get(t, 0) + 1
                suggested_watermarks = [t for t, count in common_texts.items() if count > 1]

            # 提取当前页的所有交互式元素 (用于点击去除)
            src_page = engine.src_doc[page_index]
            page_data = engine.extract_page_data(src_page, page_index=page_index)
            interactive_elements = page_data["interactive_elements"]
            
            # 提取文本供侧边栏使用
            sidebar_texts = set()
            for el in interactive_elements:
                if el["type"] == "text":
                    sidebar_texts.add(el["content"])

            # 汇总旧版兼容数据
            image_ids = list(set(el["id"] for el in interactive_elements if el["type"] == "image"))
            drawing_ids = [el["id"] for el in interactive_elements if el["type"] == "drawing"]

            return {
                "texts": sorted(list(sidebar_texts), key=len)[:300],
                "suggested_watermarks": sorted(suggested_watermarks, key=len)[:100],
                "image_ids": image_ids[:100],
                "drawing_ids": drawing_ids[:100],
                "interactive_elements": interactive_elements[:1000], # 限制数量防止响应过大
                "page_width": src_page.rect.width,
                "page_height": src_page.rect.height,
                "page_rect": [src_page.rect.x0, src_page.rect.y0, src_page.rect.x1, src_page.rect.y1]
            }
        finally:
            engine.close()
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/preview")
async def get_preview(
    file: UploadFile = File(...),
    watermark_image: UploadFile = File(None),
    page_index: int = 0,
    remove_targets_json: str = Form("{}"),
    page_modifiers_json: str = Form("{}")
):
    try:
        print(f"Preview request: page={page_index}")
        await file.seek(0)
        content = await file.read()
        
        watermark_img_data = None
        if watermark_image:
            watermark_img_data = await watermark_image.read()
        
        try:
            remove_targets = json.loads(remove_targets_json)
            page_modifiers_raw = json.loads(page_modifiers_json)
        except Exception as je:
            print(f"JSON parse error: {je}")
            return JSONResponse(status_code=400, content={"error": f"Invalid JSON: {je}"})
        
        # 预处理 page_modifiers
        page_modifiers = {}
        for page_idx_str, elements in page_modifiers_raw.items():
            processed_elements = []
            for el in elements:
                try:
                    if el["type"] == "text":
                        el["point"] = fitz.Point(el["x"], el["y"])
                        el["fontsize"] = el.get("fontsize", 12)
                        el["rotate"] = el.get("angle", 0)
                        el["opacity"] = el.get("opacity", 1.0)
                        el["fontname"] = el.get("fontname", "helv")
                        
                        # 处理颜色，从十六进制转换为 RGB 元组
                        if "color" in el and isinstance(el["color"], str):
                            el["color"] = hex_to_rgb(el["color"])
                        processed_elements.append(el)
                    elif el["type"] == "image":
                        img_data = None
                        if "base64" in el:
                            # 移除 base64 头部
                            b64_data = el["base64"]
                            if "," in b64_data:
                                b64_data = b64_data.split(",")[1]
                            img_data = base64.b64decode(b64_data)
                        elif watermark_img_data:
                            img_data = watermark_img_data
                        
                        if img_data:
                            el["stream"] = img_data
                            el["opacity"] = el.get("opacity", 1.0)
                            
                            img = Image.open(io.BytesIO(img_data))
                            w, h = img.size
                            scale = el.get("scale", 1.0)
                            rotate = el.get("angle", 0)
                            el["rotate"] = rotate
                            # 计算居中放置的 Rect
                            # 注意：前端传来的 x, y 是中心点
                            rect_w = w * scale
                            rect_h = h * scale
                            el["rect"] = fitz.Rect(
                                el["x"] - rect_w / 2, 
                                el["y"] - rect_h / 2, 
                                el["x"] + rect_w / 2, 
                                el["y"] + rect_h / 2
                            )
                            processed_elements.append(el)
                except Exception as ee:
                    print(f"Error processing element {el.get('type')}: {ee}")
            
            try:
                page_modifiers[int(page_idx_str)] = processed_elements
            except:
                pass

        engine = PDFEngine(content)
        try:
            if page_index < 0 or page_index >= len(engine.src_doc):
                print(f"Invalid page index: {page_index}, doc length: {len(engine.src_doc)}")
                return JSONResponse(status_code=400, content={"error": "Invalid page index"})
                
            # 预处理：补全目标元数据 (BBox 等)
            engine._enrich_targets(remove_targets)
            
            src_page = engine.src_doc[page_index]
            print(f"Rendering page {page_index} for preview...")
            
            add_els = page_modifiers.get(page_index, [])
            # 直接在原文档的页面上进行擦除和添加（因为每次请求都是新的 engine 实例）
            # 传入 page_index 参数，确保 render_to_page 只处理当前页面的目标
            engine.render_to_page(src_page, None, remove_targets, add_els, page_index=page_index)
            
            # 提高预览分辨率，确保清晰，且禁用 alpha 通道防止透明背景导致显示不出
            # 对于非常大的页面，限制缩放比例以防止内存溢出
            scale = 1.5
            if src_page.rect.width > 2000 or src_page.rect.height > 2000:
                scale = 1.0
            
            print("Generating pixmap...")
            pix = src_page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
            img_bytes = pix.tobytes("png")
            print(f"Generated preview image: {len(img_bytes)} bytes")
            return StreamingResponse(io.BytesIO(img_bytes), media_type="image/png")
        finally:
            engine.close()
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/reconstruct")
async def reconstruct_pdf(
    file: UploadFile = File(...),
    watermark_image: UploadFile = File(None),
    remove_targets_json: str = Form("{}"),
    page_modifiers_json: str = Form("{}")
):
    try:
        await file.seek(0)
        content = await file.read()
        
        watermark_img_data = None
        if watermark_image:
            watermark_img_data = await watermark_image.read()
            
        remove_targets = json.loads(remove_targets_json)
        page_modifiers_raw = json.loads(page_modifiers_json)
        
        page_modifiers = {}
        for page_idx_str, elements in page_modifiers_raw.items():
            processed_elements = []
            for el in elements:
                if el["type"] == "text":
                    el["point"] = fitz.Point(el["x"], el["y"])
                    el["fontsize"] = el.get("fontsize", 12)
                    el["rotate"] = el.get("angle", 0)
                    el["opacity"] = el.get("opacity", 1.0)
                    el["fontname"] = el.get("fontname", "helv")
                    # 处理颜色
                    if "color" in el and isinstance(el["color"], str):
                        el["color"] = hex_to_rgb(el["color"])
                elif el["type"] == "image":
                    img_data = None
                    if "base64" in el:
                        # 移除 base64 头部
                        b64_data = el["base64"]
                        if "," in b64_data:
                            b64_data = b64_data.split(",")[1]
                        img_data = base64.b64decode(b64_data)
                    elif watermark_img_data:
                        img_data = watermark_img_data
                    
                    if img_data:
                        el["stream"] = img_data
                        el["opacity"] = el.get("opacity", 1.0)
                        img = Image.open(io.BytesIO(img_data))
                        w, h = img.size
                        scale = el.get("scale", 1.0)
                        rotate = el.get("angle", 0)
                        el["rotate"] = rotate
                        rect_w = w * scale
                        rect_h = h * scale
                        el["rect"] = fitz.Rect(
                            el["x"] - rect_w / 2, 
                            el["y"] - rect_h / 2, 
                            el["x"] + rect_w / 2, 
                            el["y"] + rect_h / 2
                        )
                processed_elements.append(el)
            page_modifiers[int(page_idx_str)] = processed_elements
        
        engine = PDFEngine(content)
        try:
            final_doc = engine.reconstruct(remove_targets=remove_targets, page_modifiers=page_modifiers)
            
            # 关键优化：字体子集化 (Font Subsetting)
            # 这将极大减小包含中文字体的 PDF 体积，只保留用到的字符
            try:
                final_doc.subset_fonts()
            except Exception as e:
                print(f"Warning: subset_fonts failed: {e}")

            out_pdf = io.BytesIO()
            # 关键优化：garbage=4 (最高级别，包含去重)，deflate=True (压缩流)
            final_doc.save(out_pdf, garbage=4, deflate=True) 
            final_bytes = out_pdf.getvalue()
            return StreamingResponse(
                io.BytesIO(final_bytes),
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=processed.pdf"}
            )
        finally:
            engine.close()
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
