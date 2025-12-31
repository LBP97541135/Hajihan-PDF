import fitz
from PIL import Image
from io import BytesIO
import base64

def hex_to_rgb(hex_color):
    if not hex_color:
        return (0, 0, 0)
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 3:
        hex_color = ''.join([c*2 for c in hex_color])
    return tuple(int(hex_color[i:i+2], 16)/255.0 for i in (0, 2, 4))

class PDFEngine:
    def __init__(self, pdf_bytes):
        self.pdf_bytes = pdf_bytes
        self.src_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
    def close(self):
        if self.src_doc and not self.src_doc.is_closed:
            self.src_doc.close()

    def extract_page_data(self, page, page_index=0):
        """将页面解析为结构化数据 (包含源码级信息)"""
        contents_xrefs = page.get_contents()
        raw_streams = []
        for xref in contents_xrefs:
            try:
                stream = self.src_doc.xref_stream(xref).decode('latin-1')
                raw_streams.append({"xref": xref, "data": stream})
            except: pass

        # 提取交互式元素
        interactive_elements = []
        
        # 文本
        for i, block in enumerate(page.get_text("dict").get("blocks", [])):
            if block.get("type") == 0:
                for j, line in enumerate(block.get("lines", [])):
                    for k, span in enumerate(line.get("spans", [])):
                        # 增加颜色和字体信息作为唯一性的一部分
                        interactive_elements.append({
                            "type": "text",
                            "id": f"p{page_index}_b{i}_l{j}_s{k}",
                            "content": span.get("text", ""),
                            "bbox": list(span.get("bbox", [0,0,0,0])),
                            "color": span.get("color"),
                            "font": span.get("font"),
                            "size": span.get("size"),
                            "page": page_index
                        })
        
        # 图片
        for img in page.get_image_info(xrefs=True):
            interactive_elements.append({
                "type": "image",
                "id": f"p{page_index}_img_{img['xref']}",
                "content": f"Image {img['xref']}",
                "bbox": list(img.get("bbox", [0,0,0,0])),
                "page": page_index
            })

        # 矢量图形 (Drawings)
        drawings = page.get_drawings()
        for i, dw in enumerate(drawings):
            bbox = dw.get("rect")
            if bbox and (bbox.width * bbox.height > 1):
                did = f"p{page_index}_draw_{i}"
                interactive_elements.append({
                    "type": "drawing",
                    "id": did,
                    "content": f"Drawing {i}",
                    "bbox": [bbox.x0, bbox.y0, bbox.x1, bbox.y1],
                    "metadata": {
                        "type": dw.get("type"),
                        "items_count": len(dw.get("items", [])),
                        "fill": dw.get("fill") is not None,
                        "stroke": dw.get("color") is not None
                    },
                    "page": page_index
                })

        # 4. 签名/控件 (Widgets)
        for i, widget in enumerate(page.widgets()):
            bbox = widget.rect
            interactive_elements.append({
                "type": "widget",
                "id": f"p{page_index}_widget_{widget.xref}",
                "content": f"Field: {widget.field_name or 'unnamed'}",
                "bbox": [bbox.x0, bbox.y0, bbox.x1, bbox.y1],
                "page": page_index
            })

        # 5. 链接 (Links)
        for i, link in enumerate(page.get_links()):
            bbox = link.get("from")
            interactive_elements.append({
                "type": "link",
                "id": f"p{page_index}_link_{i}",
                "content": f"Link: {link.get('uri', 'internal')}",
                "bbox": [bbox.x0, bbox.y0, bbox.x1, bbox.y1],
                "page": page_index
            })

        return {
            "rect": {
                "width": page.rect.width,
                "height": page.rect.height,
                "x0": page.rect.x0,
                "y0": page.rect.y0,
                "x1": page.rect.x1,
                "y1": page.rect.y1
            },
            "interactive_elements": interactive_elements,
            "raw_streams": raw_streams
        }

    def _process_objects(self, page, remove_targets, page_index):
        """处理非内容流对象的物理删除 (Widgets, Links, XObjects)"""
        if not remove_targets:
            return

        # 1. 处理 Widgets (表单控件)
        if remove_targets.get("widgets"):
            for widget in page.widgets():
                target_id = f"p{page_index}_widget_{widget.xref}"
                if any((t.get("id") == target_id if isinstance(t, dict) else t == target_id) for t in remove_targets["widgets"]):
                    try: page.delete_widget(widget)
                    except: pass

        # 2. 处理 Links (链接)
        if remove_targets.get("links"):
            for i, link in enumerate(page.get_links()):
                target_id = f"p{page_index}_link_{i}"
                if any((t.get("id") == target_id if isinstance(t, dict) else t == target_id) for t in remove_targets["links"]):
                    try: page.delete_link(link)
                    except: pass

        # 3. 处理图片 (XObjects, Inline Images, Annotations) 的物理剔除
        if remove_targets.get("xobjects"):
            # 使用 get_image_info 获取所有图片，包括 xref=0 的内联图片
            image_info_list = page.get_image_info(xrefs=True)
            
            # 获取所有注释，以便后续匹配 (针对 xref=0 的情况)
            annots = list(page.annots())
            
            for img_info in image_info_list:
                xref_img = img_info.get("xref")
                target_id = f"p{page_index}_img_{xref_img}"
                
                if any((t.get("id") == target_id if isinstance(t, dict) else t == target_id) for t in remove_targets["xobjects"]):
                    try:
                        if xref_img > 0:
                            print(f"Deleting XObject image reference: xref {xref_img}")
                            # 这种方式是源码级的，它移除页面对该 XObject 的引用
                            page.delete_image(xref_img)
                        else:
                            # xref 为 0 可能是不在资源表中的内联图片，或者是注释（Annot）中的图片
                            bbox = img_info.get("bbox")
                            img_rect = fitz.Rect(bbox)
                            
                            # 尝试匹配注释并删除 (例如 Stamp 类型的盖章)
                            annot_deleted = False
                            img_area = img_rect.width * img_rect.height
                            for annot in annots:
                                intersect_rect = annot.rect.intersect(img_rect)
                                intersect_area = intersect_rect.width * intersect_rect.height
                                if intersect_area > img_area * 0.9:
                                    print(f"Deleting matching annotation: {annot.type} at {annot.rect}")
                                    page.delete_annot(annot)
                                    annot_deleted = True
                                    break
                            
                            if not annot_deleted:
                                # 内联图片 (Inline Image) 将在 _edit_stream_data 中通过 BI...EI 匹配删除
                                # 这里不再使用 page.add_redact_annot(bbox)
                                print(f"Inline image detected for {target_id}, will attempt stream-level removal.")
                                pass 
                    except Exception as e:
                        print(f"Error removing image {target_id}: {e}")

        # 4. 处理矢量图形 (Drawings)
        if remove_targets.get("drawings"):
            print(f"DEBUG: remove_targets['drawings'] = {remove_targets['drawings']}")
            drawings = page.get_drawings()
            for i, dw in enumerate(drawings):
                target_id = f"p{page_index}_draw_{i}"
                match = False
                for t in remove_targets["drawings"]:
                    tid = t.get("id") if isinstance(t, dict) else t
                    if tid == target_id:
                        match = True
                        break
                
                if match:
                    try:
                        bbox = dw.get("rect")
                        if bbox:
                            redact_rect = fitz.Rect(bbox) + (-2.0, -2.0, 2.0, 2.0)
                            annot = page.add_redact_annot(redact_rect)
                            annot.set_colors(fill=None)
                            annot.update()
                    except Exception as e:
                        print(f"Error marking drawing {target_id} for redaction: {e}")

    def _edit_stream_data(self, stream_data, remove_targets, add_elements, page, page_index):
        """核心流编辑器：执行源码级增删"""
        modified = False
        import re

        # --- [删除逻辑：增强版] ---
        # 1. 处理内联图片 (Inline Images BI...EI)
        if remove_targets and remove_targets.get("xobjects"):
            image_info_list = page.get_image_info(xrefs=True)
            for img_info in image_info_list:
                if img_info.get("xref") == 0:
                    target_id = f"p{page_index}_img_0"
                    if any((t.get("id") == target_id if isinstance(t, dict) else t == target_id) for t in remove_targets["xobjects"]):
                        # 尝试在流中寻找 BI...EI 块
                        # 确保 BI...EI 块内部不含其他的 BI，防止跨块匹配
                        bi_pattern = r'BI(?:(?!BI).)*?ID.*?EI'
                        regex = re.compile(bi_pattern, re.IGNORECASE | re.DOTALL)
                        if regex.search(stream_data):
                            print(f"Matched inline image BI...EI for {target_id}")
                            stream_data = regex.sub('', stream_data, count=1)
                            modified = True

        # 2. 处理文本删除
        if remove_targets and remove_targets.get("text"):
            # 获取页面的 texttrace 以提取 glyph ID (用于处理复杂编码)
            try:
                trace = page.get_texttrace()
            except:
                trace = []

            # 预处理 trace，计算每个 trace 在相同内容中的排名 (rank)
            # 这对于区分页面上多个相同的文本（如两个 "11.09"）至关重要
            hex_counts = {}
            str_counts = {}
            for t in trace:
                # 计算 hex 签名
                h_seq = "".join([f"{c[1]:04X}" for c in t['chars']])
                hex_counts[h_seq] = hex_counts.get(h_seq, 0) + 1
                t['_hex_rank'] = hex_counts[h_seq]
                t['_hex_seq'] = h_seq
                
                # 计算字符串签名
                s_content = "".join([chr(c[0]) for c in t['chars']])
                str_counts[s_content] = str_counts.get(s_content, 0) + 1
                t['_str_rank'] = str_counts[s_content]
                t['_str_content'] = s_content

            # 收集所有需要删除的 (signature, rank)
            # signature 可以是 hex_seq 或 str_content
            hex_to_remove = {} # {hex_seq: set(ranks)}
            str_to_remove = {} # {str_content: set(ranks)}

            for target in remove_targets["text"]:
                content = ""
                target_bbox = None
                should_remove = False
                
                if isinstance(target, dict):
                    if target.get("page") == page_index:
                        content = target.get("content", "")
                        target_bbox = target.get("bbox")
                        should_remove = True
                elif isinstance(target, str):
                    content = target
                    should_remove = True
                
                if should_remove and (content or target_bbox):
                    current_target_bbox = target_bbox
                    
                    # 筛选匹配的 traces
                    matching_traces = []
                    for t in trace:
                        trace_text = t['_str_content']
                        trace_bbox = t.get("bbox", [0,0,0,0])
                        
                        is_match = False
                        if current_target_bbox:
                            tx = (trace_bbox[0] + trace_bbox[2]) / 2
                            ty = (trace_bbox[1] + trace_bbox[3]) / 2
                            if (current_target_bbox[0] - 0.5 <= tx <= current_target_bbox[2] + 0.5 and 
                                current_target_bbox[1] - 0.5 <= ty <= current_target_bbox[3] + 0.5):
                                inter_x0 = max(current_target_bbox[0], trace_bbox[0])
                                inter_y0 = max(current_target_bbox[1], trace_bbox[1])
                                inter_x1 = min(current_target_bbox[2], trace_bbox[2])
                                inter_y1 = min(current_target_bbox[3], trace_bbox[3])
                                if inter_x1 > inter_x0 and inter_y1 > inter_y0:
                                    inter_area = (inter_x1 - inter_x0) * (inter_y1 - inter_y0)
                                    trace_area = (trace_bbox[2] - trace_bbox[0]) * (trace_bbox[3] - trace_bbox[1])
                                    if inter_area > trace_area * 0.8:
                                        # BBox 匹配成功。
                                        # 如果 target 有 content，必须进一步校验内容匹配
                                        # 以防止大范围 BBox 误删内部的其他文字
                                        if content and str(content).strip():
                                            t_text = trace_text.strip()
                                            c_text = str(content).strip()
                                            # 宽松匹配：trace 是 content 的一部分，或 content 是 trace 的一部分
                                            if t_text and (t_text in c_text or c_text in t_text):
                                                is_match = True
                                        else:
                                            # 没有 content 限制，则认为是纯区域删除
                                            is_match = True
                        elif content and (content == trace_text):
                            is_match = True
                        
                        if is_match:
                            matching_traces.append(t)

                    for t in matching_traces:
                        h_seq = t['_hex_seq']
                        h_rank = t['_hex_rank']
                        if h_seq not in hex_to_remove: hex_to_remove[h_seq] = set()
                        hex_to_remove[h_seq].add(h_rank)
                        
                        s_text = t['_str_content']
                        s_rank = t['_str_rank']
                        if s_text not in str_to_remove: str_to_remove[s_text] = set()
                        str_to_remove[s_text].add(s_rank)

            # 1. 执行 Hex 级删除
            for h_seq, ranks in hex_to_remove.items():
                hex_parts = [h_seq[i:i+4] for i in range(0, len(h_seq), 4)]
                
                # 核心改进：允许在 TJ 数组中 hex 序列被分割 (Kerning)
                # 例如 [<0102> -10 <0304>] TJ
                # 我们允许在 hex 码之间出现 > 10 < 这种分隔符
                flexible_sep = r'(?:\s*>\s*[-+]?\d*\.?\d*\s*<\s*)?'
                hex_pattern_core = flexible_sep.join([re.escape(p) for p in hex_parts])
                
                # 组合三种匹配模式 (Tj, TJ, BT)
                patterns = [
                    rf'(<)\s*{hex_pattern_core}\s*(>\s*[Tt][Jj])',
                    rf'(\[(?:(?![\[\]]|[Tt][Jj]).)*?<\s*){hex_pattern_core}(\s*>(?:(?![\[\]]|[Tt][Jj]).)*?\]\s*[Tt][Jj])',
                    rf'(BT(?:(?!BT|ET).)*?<)\s*{hex_pattern_core}\s*(>(?:(?!BT|ET).)*?ET)'
                ]
                combined_pattern = '|'.join([f'({p})' for p in patterns])
                regex = re.compile(combined_pattern, re.IGNORECASE | re.DOTALL)
                
                match_count = 0
                def hex_sub_func(m):
                    nonlocal match_count
                    match_count += 1
                    if match_count in ranks:
                        for i in range(1, 10, 3):
                            if m.group(i):
                                return m.group(i+1) + m.group(i+2)
                    return m.group(0)
                
                new_data = regex.sub(hex_sub_func, stream_data)
                if new_data != stream_data:
                    stream_data = new_data
                    modified = True

            # 2. 执行 String 级删除 (仅对未被 Hex 删除覆盖的内容)
            for s_text, ranks in str_to_remove.items():
                # 核心改进：同样允许字符串在 TJ 数组中被分割
                # 例如 [(ABC) -10 (DEF)] TJ
                str_parts = [re.escape(c) for c in s_text]
                flexible_sep = r'(?:\s*\)\s*[-+]?\d*\.?\d*\s*\(\s*)?'
                str_pattern_core = flexible_sep.join(str_parts)
                
                patterns = [
                    rf'(\()\s*{str_pattern_core}\s*(\)\s*[Tt][Jj])',
                    rf'(\[(?:(?![\[\]]|[Tt][Jj]).)*?\()\s*{str_pattern_core}\s*(\)(?:(?![\[\]]|[Tt][Jj]).)*?\]\s*[Tt][Jj])',
                    rf'(BT(?:(?!BT|ET).)*?\()\s*{str_pattern_core}\s*(\)(?:(?!BT|ET).)*?ET)'
                ]
                combined_pattern = '|'.join([f'({p})' for p in patterns])
                regex = re.compile(combined_pattern, re.IGNORECASE | re.DOTALL)
                
                match_count = 0
                def str_sub_func(m):
                    nonlocal match_count
                    match_count += 1
                    if match_count in ranks:
                        for i in range(1, 10, 3):
                            if m.group(i):
                                return m.group(i+1) + m.group(i+2)
                    return m.group(0)
                
                new_data = regex.sub(str_sub_func, stream_data)
                if new_data != stream_data:
                    stream_data = new_data
                    modified = True

        return stream_data, modified

    def _get_all_xobject_xrefs(self, xref, seen=None):
        """递归获取所有嵌套的 XObject xrefs"""
        if seen is None:
            seen = set()
        
        if xref in seen:
            return seen
        
        seen.add(xref)
        
        # 检查该对象是否包含其他 XObjects
        try:
            xobject_list = self.src_doc.get_page_xobjects(xref) if hasattr(self.src_doc, 'get_page_xobjects') else []
            # 注意：PyMuPDF 中没有直接获取 XObject 内部引用的简单方法，
            # 通常需要解析 /Resources 字典。这里使用 get_xobjects 的变体或解析。
            # 实际上，page.get_xobjects() 已经能覆盖大部分情况。
            # 这里的递归主要针对 Form XObject 内部可能引用的其他 Form XObject。
        except:
            pass
            
        return seen

    def render_to_page(self, page, data, remove_targets=None, add_elements=None, page_index=None):
        """模块化重构后的页面渲染逻辑"""
        # 1. 处理对象级物理删除 (Widgets, Links, XObjects, Drawings)
        # 注意：先执行物理删除，再执行内容流编辑
        self._process_objects(page, remove_targets, page_index)

        # 2. 清理页面内容流 (放在物理删除之后)
        try:
            # clean_contents 会合并碎片化的内容流指令，有助于后续的源码正则匹配
            page.clean_contents()
        except:
            pass

        # 3. 处理内容流级源码编辑 (Text, Inline Images)
        # 收集所有相关的 stream xrefs (包括内容流和引用的 XObjects)
        all_stream_xrefs = set(page.get_contents())
        
        # 递归获取页面直接引用的所有 XObjects
        xobject_list = page.get_xobjects()
        for x in xobject_list:
            xref = x[0]
            all_stream_xrefs.add(xref)

        for xref in all_stream_xrefs:
            try:
                # 使用 latin-1 以保持二进制数据的完整性
                stream_data = self.src_doc.xref_stream(xref).decode('latin-1')
                # 注意：这里只处理删除逻辑
                new_data, modified = self._edit_stream_data(
                    stream_data, remove_targets, None, page, page_index
                )
                if modified:
                    self.src_doc.update_stream(xref, new_data.encode('latin-1'))
            except Exception as e:
                print(f"Error editing stream {xref}: {e}")

        # 4. 处理新增元素 (Watermarks/Elements)
        # 放在所有删除和流更新之后，确保新元素在最上层
        if add_elements:
            for el in add_elements:
                try:
                    if el.get("type") == "text":
                        text = el.get("text", "")
                        point = el.get("point", fitz.Point(0, 0))
                        fontsize = el.get("fontsize", 12)
                        color = el.get("color", (0, 0, 0))
                        rotate = el.get("rotate", 0)
                        opacity = el.get("opacity", 1.0)
                        fontname = el.get("fontname", "helv")
                        
                        # 为了实现中心对齐，我们需要计算文本宽度
                        # 字体映射表
                        font_map = {
                            "song": "/usr/share/fonts/truetype/arphic/uming.ttc",
                            "kai": "/usr/share/fonts/truetype/arphic/ukai.ttc",
                            "xingkai": "/usr/share/fonts/truetype/arphic/ukai.ttc", # 暂用楷体代替行楷
                            "yahei": "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
                            "times-roman": "tiro"
                        }

                        # 确定最终使用的 fontname 和 font 对象
                        final_fontname = fontname
                        try:
                            if fontname in font_map:
                                f_path = font_map[fontname]
                                if f_path.startswith("/"):
                                    # 自定义字体：需要先注册到页面
                                    # 使用 fontname 作为引用名，必须确保整个文档一致
                                    # 注意：insert_font 的 fontname 参数是 PDF 内部使用的资源名
                                    page.insert_font(fontname=fontname, fontfile=f_path)
                                    # 创建 font 对象用于计算宽度
                                    font = fitz.Font(fontfile=f_path)
                                    final_fontname = fontname
                                else:
                                    # 内置字体
                                    font = fitz.Font(f_path)
                                    final_fontname = f_path
                            else:
                                # 尝试直接加载 (如果不是 helv 等标准名，可能会失败)
                                font = fitz.Font(fontname)
                                final_fontname = fontname
                        except Exception as e:
                            # 如果加载失败，回退到 Helvetica
                            print(f"Font loading failed for {fontname}: {e}, falling back to helv")
                            font = fitz.Font("helv")
                            final_fontname = "helv"
                            
                        text_width = font.text_length(text, fontsize=fontsize)
                        
                        # 计算偏移量：水平居中 (width/2)，垂直居中 (约 fontsize/3)
                        # 注意：insert_text 的 point 是基线左侧点
                        # 我们先计算相对于中心点的原始偏移
                        origin_x = point.x - text_width / 2
                        origin_y = point.y + fontsize / 3
                        
                        # 为了支持旋转，我们使用 Matrix
                        # morph 参数 (fixed_point, matrix) 表示以 fixed_point 为中心应用 matrix
                        matrix = fitz.Matrix(rotate)
                        
                        page.insert_text(
                            fitz.Point(origin_x, origin_y), 
                            text, 
                            fontsize=fontsize, 
                            color=color, 
                            morph=(point, matrix),
                            fill_opacity=opacity,
                            stroke_opacity=opacity,
                            fontname=final_fontname
                        )
                    elif el.get("type") == "image" and "stream" in el:
                        rect = el.get("rect")
                        rotate = el.get("rotate", 0)
                        if rect:
                            page.insert_image(
                                rect, 
                                stream=el["stream"], 
                                overlay=True,
                                rotate=rotate
                            )
                except Exception as e:
                    print(f"Error adding element to page: {e}")

        # 5. 最后执行 apply_redactions
        # 这一步必须放在所有 update_stream 之后，因为它会重新生成内容流并移除被遮盖的指令
        if remove_targets and remove_targets.get("drawings"):
            try:
                # graphics=2: 只删除红框内的矢量指令片段。配合微小边距，可精准移除水印源码。
                page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=2, text=False)
            except Exception as e:
                print(f"Error applying final redactions: {e}")

    def _enrich_targets(self, remove_targets):
        """
        补全 remove_targets 中的缺失信息 (如根据 id 补全 bbox, 根据 content 补全 metadata)
        确保传入后端的哪怕只有简单信息，也能在后端被补全为高精度信息。
        """
        if not remove_targets:
            return

        # 建立一个全局映射表
        lookup_map = {
            "text": {},
            "xobjects": {},
            "drawings": {},
            "widgets": {},
            "links": {}
        }

        # 扫描所有页面提取全量元数据
        for i in range(len(self.src_doc)):
            page = self.src_doc[i]
            # 临时重用提取逻辑
            page_data = self.extract_page_data(page, page_index=i)
            for el in page_data["interactive_elements"]:
                el_type = el["type"]
                # 转换类型名称以匹配 remove_targets 的 key
                if el_type == "text": map_key = "text"
                elif el_type == "image": map_key = "xobjects"
                else: map_key = f"{el_type}s"
                
                if map_key in lookup_map:
                    lookup_map[map_key][el["id"]] = el
                    # 同时支持通过内容搜索（仅限文本）
                    if el_type == "text":
                        content = el["content"]
                        if content not in lookup_map["text"]:
                            lookup_map["text"][content] = el

        # 执行补全
        for category in ["text", "xobjects", "drawings", "widgets", "links"]:
            if category not in remove_targets: continue
            
            targets = remove_targets[category]
            new_targets = []
            for t in targets:
                if isinstance(t, str):
                    # 如果是纯字符串且是文本类，尝试寻找匹配的对象补全坐标
                    if category == "text" and t in lookup_map["text"]:
                        new_targets.append(lookup_map["text"][t])
                    else:
                        new_targets.append(t)
                elif isinstance(t, dict):
                    tid = t.get("id")
                    if tid and tid in lookup_map[category]:
                        # 合并信息：用查找到的完整信息作为基础，保留传入的特定覆盖
                        enriched = lookup_map[category][tid].copy()
                        enriched.update(t)
                        new_targets.append(enriched)
                    else:
                        new_targets.append(t)
            remove_targets[category] = new_targets

    def reconstruct(self, remove_targets=None, page_modifiers=None):
        """
        通过直接修改原文档来重构 PDF
        """
        # 0. 自动补全目标信息 (后端补全，确保精度)
        self._enrich_targets(remove_targets)

        # 1. 处理 OCG 图层
        if remove_targets and remove_targets.get("layers"):
            for xref in remove_targets["layers"]:
                self.src_doc.set_ocg(xref, on=False)

        for i in range(len(self.src_doc)):
            page = self.src_doc[i]
            add_els = page_modifiers.get(i, []) if page_modifiers else []
            # 在原页面上应用修改，传入当前页面索引 i
            self.render_to_page(page, None, remove_targets, add_els, page_index=i)
            
        return self.src_doc

def get_signature_preview(pdf_bytes, sig_image_bytes, x_pos, y_pos, scale, page_index=0):
    """
    生成带有签名的预览图 (保留用于兼容性，但内部实现已优化)
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        page = doc[page_index]
        if sig_image_bytes:
            sig_img = Image.open(BytesIO(sig_image_bytes))
            sig_w, sig_h = sig_img.size
            w = sig_w * scale
            h = sig_h * scale
            rect = fitz.Rect(x_pos, y_pos, x_pos + w, y_pos + h)
            page.insert_image(rect, stream=sig_image_bytes)
            
        pix = page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5)) # 降低预览分辨率
        img = Image.open(BytesIO(pix.tobytes("png")))
        return img
    finally:
        doc.close()
