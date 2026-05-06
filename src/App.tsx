/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Search, 
  Activity, 
  Layers, 
  RefreshCcw,
  Info,
  ChevronRight,
  Sparkles,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { recognizeHanNomImage } from './api/gemini.js';

let pdfJsModulePromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function loadPdfJs() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import('pdfjs-dist').then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      return pdfjsLib;
    });
  }

  return pdfJsModulePromise;
}

interface RecognitionResult {
  verticalText: string; // Used for paired Hán Nôm lines
  sinoVietnamese: string; // Used for paired Sino-Vietnamese lines
  modernVietnamese: string;
  confidence: number;
  tokens: { char: string; confidence: number }[];
}

const TRANSLATIONS = {
  ja: {
    title: "漢喃 OCR エクスプローラー",
    subtitle: "縦書き文字認識の研究用インターフェース",
    library: "ライブラリ",
    source: "ドキュメントソース",
    clear: "入力をクリア",
    uploadTitle: "古文書をアップロード",
    uploadSubtitle: "ドラッグ＆ドロップまたはクリックして参照",
    runEngine: "認識エンジンを実行",
    architecture: "ニューラルネットワーク構成",
    ocrTranslation: "OCR 翻訳・解読",
    nativeScript: "原文 (縦書き)",
    sinoVietnamese: "漢越音 (音読み)",
    modernVietnamese: "現代ベトナム語訳 (意訳)",
    confidence: "信頼度ヒートマップ",
    pending: "ドキュメント解析待ち...",
    complete: "認識完了",
    retry: "エンジンを再試行",
    processing: "ニューラルパス伝播をシミュレート中...",
    page: "ページ",
    of: "/",
    recognizeThisPage: "このページを認識する",
    footerDataset: "漢喃データセット v2024.0.1",
    footerContext: "OCRトレーニングコンテキスト: 縦方向シーケンス"
  },
  vi: {
    title: "Hán Nôm OCR Explorer",
    subtitle: "Giao diện nghiên cứu nhận diện chữ viết dọc",
    library: "Thư viện",
    source: "Nguồn tài liệu",
    clear: "Xóa đầu vào",
    uploadTitle: "Tải lên bản thảo cổ",
    uploadSubtitle: "Kéo thả hoặc click để chọn tệp",
    runEngine: "Chạy engine nhận diện",
    architecture: "Kiến trúc huấn luyện Neural",
    ocrTranslation: "Dịch & Giải mã OCR",
    nativeScript: "Văn bản gốc (Dọc)",
    sinoVietnamese: "Âm Hán Việt",
    modernVietnamese: "Dịch nghĩa Tiếng Việt",
    confidence: "Bản đồ độ tin cậy",
    pending: "Đang chờ phân tích...",
    complete: "Nhận diện hoàn tất",
    retry: "Thử lại",
    processing: "Đang mô phỏng truyền tệp neural...",
    page: "Trang",
    of: "trên",
    recognizeThisPage: "Nhận diện trang này",
    footerDataset: "Bộ dữ liệu Hán Nôm v2024.0.1",
    footerContext: "Ngữ cảnh huấn luyện OCR: Chuỗi ký tự dọc"
  }
};

type Lang = 'ja' | 'vi';

export default function App() {
  const [lang, setLang] = useState<Lang>('ja');
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfProxy, setPdfProxy] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = TRANSLATIONS[lang] as any;

  const renderPdfPage = async (pdf: any, pageNum: number) => {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas'); 
      const context = canvas.getContext('2d');
      if (!context) return;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      const dataUrl = canvas.toDataURL('image/jpeg');
      setImage(dataUrl);
      setResult(null);
    } catch (err) {
      console.error("Error rendering PDF page:", err);
      setError("Failed to render PDF page.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      if (file.type === 'application/pdf') {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdfjsLib = await loadPdfJs();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          setPdfProxy(pdf);
          setNumPages(pdf.numPages);
          setCurrentPage(1);
          await renderPdfPage(pdf, 1);
        } catch (err) {
          console.error("PDF loading error:", err);
          setError(lang === 'ja' ? "PDFの読み込みに失敗しました。" : "Không thể tải tài liệu PDF.");
        }
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setImage(event.target?.result as string);
          setPdfProxy(null);
          setNumPages(0);
          setResult(null);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const goToPage = async (page: number) => {
    if (pdfProxy && page >= 1 && page <= numPages) {
      setCurrentPage(page);
      await renderPdfPage(pdfProxy, page);
    }
  };

  const processOCR = async () => {
    if (!image) return;

    setIsProcessing(true);
    setError(null);

    try {
      const [dataUrlHeader, base64Data] = image.split(',');
      const mimeType = dataUrlHeader.match(/^data:(.*);base64$/)?.[1] || 'image/jpeg';
      const data = await recognizeHanNomImage({ imageBase64: base64Data, mimeType });
      setResult(data as RecognitionResult);
    } catch (err) {
      console.error(err);
      setError(lang === 'ja' ? "画像の処理に失敗しました。品質を確認してください。" : "Không thể xử lý ảnh. Vui lòng kiểm tra lại chất lượng tài liệu.");
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setPdfProxy(null);
    setNumPages(0);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col md:flex-row font-sans selection:bg-seal/10">
      {/* Left Column: Fixed Source Area */}
      <section className="w-full md:w-[45%] lg:w-[40%] md:h-screen md:sticky md:top-0 border-b md:border-b-0 md:border-r border-ink/10 bg-paper/50 flex flex-col z-20 overflow-hidden">
        <header className="px-6 py-4 border-b border-ink/5 bg-white/80 backdrop-blur-sm flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-seal flex items-center justify-center rounded-sm rotate-45">
              <FileText className="text-white -rotate-45" size={16} />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold tracking-tight text-ink uppercase leading-none">
                {t.title}
              </h1>
              <p className="text-[8px] uppercase tracking-widest text-ink/40 font-semibold mt-1">
                {t.subtitle}
              </p>
            </div>
          </div>
          <div className="flex bg-ink/5 p-1 rounded-sm border border-ink/10 scale-75">
            <button 
              onClick={() => setLang('ja')}
              className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest transition-all ${lang === 'ja' ? 'bg-seal text-white shadow-sm' : 'text-ink/40 hover:text-ink/60'}`}
            >
              JA
            </button>
            <button 
              onClick={() => setLang('vi')}
              className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest transition-all ${lang === 'vi' ? 'bg-seal text-white shadow-sm' : 'text-ink/40 hover:text-ink/60'}`}
            >
              VI
            </button>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 flex flex-col gap-6 overflow-y-auto">
          <div className="flex justify-between items-end">
            <h2 className="font-serif text-sm font-bold flex items-center gap-2 text-ink/80 uppercase tracking-widest">
              <Activity size={16} className="text-seal" /> {t.source}
            </h2>
            {image && (
              <button 
                onClick={reset}
                className="text-[9px] uppercase tracking-widest text-ink/60 hover:text-seal font-bold flex items-center gap-1"
              >
                <RefreshCcw size={10} /> {t.clear}
              </button>
            )}
          </div>

          <div 
            className={`flex-1 relative rounded-lg border-2 border-dashed transition-all overflow-hidden flex flex-col items-center justify-center p-4 min-h-[300px]
              ${image ? 'border-ink/20 bg-white shadow-xl' : 'border-ink/10 bg-ink/[0.02] hover:border-seal/40 group cursor-pointer'} 
              document-shadow`}
            onClick={() => !image && fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) {
                const fakeEvent = { target: { files: [file] } } as any;
                handleFileUpload(fakeEvent);
              }
            }}
          >
            {image ? (
              <div className="h-full w-full flex flex-col items-center justify-center gap-4">
                {pdfProxy && (
                  <div className="flex items-center gap-4 py-2 px-6 bg-ink/5 rounded-full border border-ink/10 mb-2 scale-[0.8] md:scale-90">
                    <button 
                      onClick={(e) => { e.stopPropagation(); goToPage(1); }}
                      disabled={currentPage === 1}
                      className="p-1 hover:text-seal disabled:opacity-30"
                    >
                      <ChevronsLeft size={16} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); goToPage(currentPage - 1); }}
                      disabled={currentPage === 1}
                      className="p-1 hover:text-seal disabled:opacity-30"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold font-mono tracking-tighter min-w-[60px] text-center">
                      {(t as any).page} {currentPage} / {numPages}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); goToPage(currentPage + 1); }}
                      disabled={currentPage === numPages}
                      className="p-1 hover:text-seal disabled:opacity-30"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); goToPage(numPages); }}
                      disabled={currentPage === numPages}
                      className="p-1 hover:text-seal disabled:opacity-30"
                    >
                      <ChevronsRight size={16} />
                    </button>
                  </div>
                )}
                
                <div className="relative w-full h-full overflow-hidden rounded shadow-inner bg-[#e0dfdb] flex items-center justify-center">
                  <img src={image} alt="Source" className="object-contain w-full h-full p-2" />
                  <AnimatePresence>
                    {isProcessing && (
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: "100%" }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 bg-seal/20 backdrop-blur-[1px] border-t-2 border-seal shadow-[0_-20px_40px_rgba(178,34,34,0.3)] z-10"
                      />
                    )}
                  </AnimatePresence>
                </div>
                {!result && !isProcessing && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); processOCR(); }}
                    className="group px-6 py-2.5 bg-seal text-white font-bold uppercase tracking-[0.2em] text-[10px] flex items-center gap-3 hover:translate-y-[-2px] transition-all shadow-lg shadow-seal/20"
                  >
                    <Activity size={14} /> {pdfProxy ? (t as any).recognizeThisPage : t.runEngine}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center space-y-4 p-4">
                <div className="w-12 h-12 bg-ink/5 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <Upload className="text-ink/30 group-hover:text-seal transition-colors" size={24} />
                </div>
                <div>
                  <p className="font-serif text-lg font-medium text-ink/80">{t.uploadTitle}</p>
                  <p className="text-[10px] text-ink/40 mt-1 uppercase tracking-wider">{t.uploadSubtitle}</p>
                </div>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload} 
              accept="image/*,.pdf"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 opacity-60">
            <div className="p-3 bg-white/50 border border-ink/5 rounded-md flex items-center gap-3">
              <Layers className="text-seal" size={14} />
              <div>
                <p className="text-[8px] font-bold uppercase text-ink/40 tracking-wider">Engine</p>
                <p className="text-[10px] font-semibold">CNN-LSTM Neural Model v2.4</p>
              </div>
            </div>
            <div className="p-3 bg-white/50 border border-ink/5 rounded-md flex items-center gap-3">
              <Sparkles className="text-seal" size={14} />
              <div>
                <p className="text-[8px] font-bold uppercase text-ink/40 tracking-wider">Decoding</p>
                <p className="text-[10px] font-semibold">CTC Greedy Path Search</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Right Column: Scrollable Analysis Area */}
      <section className="flex-1 bg-paper min-h-screen p-6 md:p-12 lg:p-16">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="flex justify-between items-end border-b border-ink/10 pb-4">
            <h2 className="font-serif text-2xl font-bold flex items-center gap-3 text-ink/90">
              <Search size={24} className="text-seal" /> {t.ocrTranslation}
            </h2>
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-seal/40" />
              <div className="w-2 h-2 rounded-full bg-ink/10" />
            </div>
          </div>

          <div className="space-y-12">
            {isProcessing ? (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative">
                  <div className="w-16 h-16 border-2 border-seal/10 rounded-full" />
                  <div className="w-16 h-16 border-t-2 border-seal rounded-full absolute inset-0 animate-spin" />
                </div>
                <p className="font-serif italic text-xl text-ink/60 leading-relaxed max-w-xs">{t.processing}</p>
              </div>
            ) : result ? (
              <>
                {/* Horizontal Paired Display: Hán Nôm & Sino-Vietnamese */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <div className="flex justify-between items-center border-b border-ink/5 pb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-seal">{t.sinoVietnamese}</p>
                      <div className="w-1.5 h-1.5 bg-seal/20 rounded-full" />
                    </div>
                  </div>
                  
                  <div className="space-y-12">
                    {result.verticalText.split('\n').filter(l => l.trim()).map((hLine, idx) => {
                      const sLines = result.sinoVietnamese.split('\n').filter(l => l.trim());
                      const sLine = sLines[idx] || "";
                      
                      return (
                        <div key={idx} className="group relative">
                          <div className="absolute -left-8 top-0 p-1 text-[10px] font-mono font-bold text-seal/30 select-none">
                            [{idx + 1}]
                          </div>
                          <div className="space-y-4">
                            {/* Original Hán Nôm (Horizontal) */}
                            <div className="font-han text-3xl md:text-4xl text-ink/90 tracking-[0.1em] leading-tight">
                              {hLine}
                            </div>
                            {/* Sino-Vietnamese Reading */}
                            <div className="font-serif text-xl text-seal italic leading-relaxed pl-1">
                              {sLine}
                            </div>
                          </div>
                          {idx < result.verticalText.split('\n').filter(l => l.trim()).length - 1 && (
                            <div className="mt-8 border-b border-ink/[0.03] w-full" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Modern Vietnamese Translation */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-4 pt-12"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-seal border-b border-ink/5 pb-2">{t.modernVietnamese}</p>
                  <div className="font-serif text-lg leading-relaxed text-ink/80 bg-white p-8 rounded-sm border border-ink/5 shadow-sm first-letter:text-4xl first-letter:font-bold first-letter:text-seal first-letter:mr-3 first-letter:float-left">
                    {result.modernVietnamese}
                  </div>
                </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-3"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-seal border-b border-ink/5 pb-2">{t.confidence}</p>
                    <div className="flex flex-wrap gap-1">
                      {result.tokens.map((token, idx) => (
                        <div 
                          key={idx}
                          className="px-2 py-2 rounded text-lg font-han flex flex-col items-center gap-1 group relative transition-all"
                          style={{ backgroundColor: `rgba(178,34,34, ${Math.max(0.05, token.confidence * 0.2)})` }}
                        >
                          {token.char}
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-ink text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            {(token.confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </>
              ) : error ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <Info className="text-seal mb-4" size={32} />
                  <p className="font-serif text-lg text-ink/80">{error}</p>
                  <button onClick={processOCR} className="mt-4 text-xs font-bold uppercase tracking-widest text-seal underline underline-offset-4">{t.retry}</button>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6 opacity-30">
                  <div className="w-16 h-16 border-2 border-dashed border-ink flex items-center justify-center rotate-45">
                    <FileText className="-rotate-45" size={24} />
                  </div>
                  <p className="font-serif italic">{t.pending}</p>
                </div>
              )}
            </div>

            {result && (
              <div className="p-4 bg-ink/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
                  <span className="text-[10px] font-bold text-ink/60 uppercase">{t.complete}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-[10px] font-bold text-ink/40">CTC Score: <span className="text-ink font-mono">{(result.confidence * 100).toFixed(2)}%</span></div>
                  <ChevronRight size={14} className="text-ink/30" />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Footer Info */}
        <footer className="fixed bottom-0 right-0 p-4 z-30 pointer-events-none opacity-30">
          <div className="flex items-center gap-4 text-[8px] font-bold uppercase tracking-widest text-ink">
            <span>{t.footerDataset}</span>
            <div className="w-1 h-1 rounded-full bg-ink/20" />
            <span>{t.footerContext}</span>
          </div>
        </footer>
      </div>
    );
  }
